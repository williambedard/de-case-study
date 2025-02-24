if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        formData.append('properties[_free_gift]', 'true');
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    this.cart.renderContents(response);
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              this.cart.renderContents(response);
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}

// Custom element that handles the removal of free gifts when cart total drops below threshold
class CartGiftHandler extends HTMLElement {
  constructor() {
    super();
    this.cartThreshold = parseFloat(this.dataset.cartThreshold) || 0;
    this.sectionId = this.dataset.sectionId;
    this.customerEligible = this.dataset.customerEligible === 'true';

    // Debounce the cart update handler
    const debouncedHandler = debounce((event) => {
      if (event.source === 'cart-gift-handler') return;
      this.handleCartUpdate(event);
    }, 100); // Small delay to let other updates finish

    subscribe(PUB_SUB_EVENTS.cartUpdate, debouncedHandler);
  }

  async handleCartUpdate(event) {
    const cartData = await this.getCartContents();
    if (!cartData) return;

    const cartTotal = cartData.total_price / 100;
    const giftCount = cartData.items.filter(item => 
      item.properties && item.properties._free_gift === 'true'
    ).length;

    // Remove gifts ONLY if there's more than one
    if (giftCount > 1) {
      await this.handleGiftSection(cartData.items);
      return;
    }

    // Eligible customers can always keep/add a gift
    if (this.customerEligible) {
      await this.handleGiftSection(cartData.items, false);
      return;
    }

    // Non-eligible customers need to meet threshold
    if (cartTotal >= this.cartThreshold) {
      await this.handleGiftSection(cartData.items, false);
    } else {
      await this.handleGiftSection(cartData.items);
    }
  }

  async getCartContents() {
    const response = await fetch(`${routes.cart_url}.js`);
    return response.json();
  }

  async handleGiftSection(cartItems, shouldRemoveGifts = true) {
    const updates = {};
    if (shouldRemoveGifts) {
      cartItems.forEach(item => {
        if (item.properties && item.properties._free_gift === 'true') {
          updates[item.key] = 0;
        }
      });
    }

    try {
      const response = await fetch(`${routes.cart_update_url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          updates,
          sections: [this.sectionId]
        })
      });

      const responseData = await response.json();
      
      // Update section with proper DOM manipulation
      if (responseData.sections && responseData.sections[this.sectionId]) {
        const currentSection = document.getElementById(`shopify-section-${this.sectionId}`);
        if (currentSection) {
          // Create a temporary container
          const temp = document.createElement('div');
          temp.innerHTML = responseData.sections[this.sectionId].trim();
          
          // Get the new section element
          const newSection = temp.firstElementChild;
          
          // Replace the old section with the new one
          if (currentSection.parentNode) {
            currentSection.parentNode.replaceChild(newSection, currentSection);
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        publish(PUB_SUB_EVENTS.cartUpdate, {
          source: 'cart-gift-handler',
          cartData: responseData
        });
      }
    } catch (error) {
      console.error('Error updating gift section:', error);
    }
  }
}

// Register the custom element with the browser
customElements.define('cart-gift-handler', CartGiftHandler);
