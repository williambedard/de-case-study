class CartFreeGiftHandler {
    constructor(element) {
      this.element = element;
      this.cartThreshold = parseInt(this.element.getAttribute('data-threshold')) || 300;
      this.section = document.getElementById('shopify-section-cart-free-gift');
      this.sectionTitle = document.querySelector('.collection__title .title');
      this.productCards = document.querySelectorAll('.free-gift-product-card');
      
      setTimeout(() => this.handleCartUpdate(), 0);
      
      const cartItems = document.querySelector('cart-items');
      if (cartItems) {
        const observer = new MutationObserver(() => {
          setTimeout(() => this.handleCartUpdate(), 100);
        });
        observer.observe(cartItems, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true
        });
      }
    }
  
    async handleCartUpdate() {
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        const cartTotal = cart.total_price / 100;
        const thresholdMet = parseFloat(cartTotal) >= parseFloat(this.cartThreshold);

        if (this.section) {
            this.section.style.setProperty('display', thresholdMet ? 'block' : 'none', 'important');
        }

        if (thresholdMet) {
          const hasGift = cart.items.some(item => 
            item.title.toLowerCase().includes('free gift') && 
            item.properties?._is_free_gift === 'true'
          );

          if (this.sectionTitle) {
            this.sectionTitle.textContent = hasGift 
              ? "Your free gift was added to cart!" 
              : "Choose your free gift";
          }

          this.productCards.forEach(card => {
            card.style.setProperty('display', hasGift ? 'none' : 'block', 'important');
          });
        }

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

    disconnectedCallback() {
      if (this.cartUpdateUnsubscriber) {
        this.cartUpdateUnsubscriber();
      }
    }
}

customElements.define('cart-free-gift-handler', class extends HTMLElement {
  connectedCallback() {
    new CartFreeGiftHandler(this);
  }
});