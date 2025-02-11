class CartFreeGiftHandler {
    constructor(element) {
      this.element = element;
      this.cartThreshold = parseInt(this.element.getAttribute('data-threshold')) || 300;
      this.section = document.querySelector('.shopify-section.section');
      this.collectionDiv = document.querySelector('.collection');
      this.giftSection = document.querySelector('.cart-free-gift-section');
      this.sectionTitle = document.querySelector('.cart-free-gift-section__title');
      this.productCards = document.querySelectorAll('.free-gift-product-card');
      console.log('🎁 Free Gift Handler Initialized. Threshold:', this.cartThreshold);
      
      if (!this.section || !this.collectionDiv) {
        console.log('⚠️ Free Gift section elements not found on this page');
      }
      
      this.init();
    }
  
    init() {
      // Watch for DOM changes in the cart-items element
      const cartItems = document.querySelector('cart-items');
      if (cartItems) {
        const observer = new MutationObserver((mutations) => {
          console.log('🔄 Cart content updated');
          // Add small delay to ensure cart is fully updated
          setTimeout(() => this.handleCartUpdate(), 100);
        });
        
        observer.observe(cartItems, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }

      // Add property to all gift product forms
      document.querySelectorAll('.free-gift-product-card form[action="/cart/add"]').forEach(form => {
        const propertyInput = document.createElement('input');
        propertyInput.type = 'hidden';
        propertyInput.name = 'properties[_is_free_gift]';
        propertyInput.value = 'true';
        
        form.appendChild(propertyInput);
      });
      
      // Initial check
      this.handleCartUpdate();
    }
  
    async handleCartUpdate() {
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        const cartTotal = cart.total_price / 100;
        const thresholdMet = parseFloat(cartTotal) >= parseFloat(this.cartThreshold);
        
        // Check for gift items without the property
        const giftItems = cart.items.filter(item => 
            item.title.toLowerCase().includes('free gift') && 
            (!item.properties || !item.properties._is_free_gift)
        );

        let currentCart = cart;

        // If we found any gift items without the property, update them
        if (giftItems.length > 0) {
            console.log('🎁 Found gift items without property:', giftItems);
            await this.updateGiftProperties(giftItems);
            
            // Fetch updated cart again after properties update
            const updatedResponse = await fetch('/cart.js');
            currentCart = await updatedResponse.json();
        }

        // Determine if there's a gift in cart
        const hasGift = currentCart.items.some(item => 
            item.title.toLowerCase().includes('free gift') && 
            item.properties && 
            item.properties._is_free_gift === 'true'
        );

        // Update section visibility based on threshold
        if (this.section) {
            this.section.style.display = thresholdMet ? 'block' : 'none';
        }
        if (this.giftSection) {
            this.giftSection.style.display = thresholdMet ? 'block' : 'none';
        }

        // If threshold is met, handle the gift status display
        if (thresholdMet) {
            // Update title text
            if (this.sectionTitle) {
                this.sectionTitle.textContent = hasGift 
                    ? "Your free gift was added to cart!"
                    : "Choose your free gift";
            }

            // Toggle product cards visibility
            this.productCards.forEach(card => {
                card.style.display = hasGift ? 'none' : 'block';
            });
        }

        // Cart state log
        console.log('🛒 Cart Update:', {
            cartTotal: `$${cartTotal.toFixed(2)}`,
            threshold: `$${this.cartThreshold}`,
            thresholdMet: thresholdMet,
            hasGift: hasGift
        });

      } catch (error) {
        console.error('❌ Error handling cart update:', error);
      }
    }
  
    async updateGiftProperties(giftItems) {
      for (const item of giftItems) {
        try {
          await fetch('/cart/change.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: item.key,
              quantity: item.quantity,
              properties: {
                _is_free_gift: 'true'
              }
            })
          });
          console.log('✅ Added free gift property to:', item.title);
        } catch (error) {
          console.error('❌ Error updating gift property:', error);
        }
      }
    }
}
  
// Initialize the handler
customElements.define('cart-free-gift-handler', class extends HTMLElement {
  connectedCallback() {
    new CartFreeGiftHandler(this);
  }
});