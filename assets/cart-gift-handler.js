class CartFreeGiftHandler {
    constructor(element) {
        this.element = element;
        this.cartThreshold = parseInt(this.element.getAttribute('data-threshold')) || 300;
        this.section = document.querySelector('.shopify-section.section');
        this.collectionDiv = document.querySelector('.collection');
        this.giftSection = document.querySelector('.cart-free-gift-section');
        this.sectionTitle = document.querySelector('.collection__title .title');
        this.productCards = document.querySelectorAll('.free-gift-product-card');
        
        this.init();
    }

    async handleCartUpdate() {
        try {
            const response = await fetch('/cart.js');
            const cart = await response.json();
            const cartTotal = cart.total_price / 100;
            const thresholdMet = parseFloat(cartTotal) >= parseFloat(this.cartThreshold);
            
            const giftItems = cart.items.filter(item => 
                item.title.toLowerCase().includes('free gift') && 
                (!item.properties || !item.properties._is_free_gift)
            );

            let currentCart = cart;

            if (giftItems.length > 0) {
                await this.updateGiftProperties(giftItems);
                const updatedResponse = await fetch('/cart.js');
                currentCart = await updatedResponse.json();
            }

            const hasGift = currentCart.items.some(item => 
                item.title.toLowerCase().includes('free gift') && 
                item.properties && 
                item.properties._is_free_gift === 'true'
            );

            if (this.section) {
                this.section.style.display = thresholdMet ? 'block' : 'none';
            }
            if (this.giftSection) {
                this.giftSection.style.display = thresholdMet ? 'block' : 'none';
            }

            if (thresholdMet) {
                if (this.sectionTitle) {
                    this.sectionTitle.textContent = hasGift 
                        ? "Your free gift was added to cart!" 
                        : "Choose your free gift";
                }

                this.productCards.forEach(card => {
                    card.style.display = hasGift ? 'none' : 'block';
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
            } catch (error) {
                console.error('❌ Error updating gift property:', error);
            }
        }
    }

    init() {
        const cartItems = document.querySelector('cart-items');
        if (cartItems) {
            const observer = new MutationObserver(() => {
                setTimeout(() => this.handleCartUpdate(), 100);
            });
            
            observer.observe(cartItems, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        document.querySelectorAll('.free-gift-product-card form[action="/cart/add"]').forEach(form => {
            const propertyInput = document.createElement('input');
            propertyInput.type = 'hidden';
            propertyInput.name = 'properties[_is_free_gift]';
            propertyInput.value = 'true';
            
            form.appendChild(propertyInput);
        });
        
        this.handleCartUpdate();
    }
}

customElements.define('cart-free-gift-handler', class extends HTMLElement {
    connectedCallback() {
        new CartFreeGiftHandler(this);
    }
});