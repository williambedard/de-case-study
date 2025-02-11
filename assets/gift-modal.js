class GiftModal extends HTMLElement {
  constructor() {
    super();
    this.modal = document.getElementById('GiftModal');
    console.log('Modal initialized');
    this.loadCampaignData();
    this.bindEvents();
  }

  loadCampaignData() {
    const dataElement = document.getElementById('giftCampaignData');
    console.log('Data element:', dataElement);
    if (dataElement) {
      this.campaignData = JSON.parse(dataElement.textContent);
      console.log('Campaign data structure:', this.campaignData);
      
      // Check if we have optional_gift_variants
      if (this.campaignData.variant_ids) {
        this.fetchVariantData();
      }
    }
  }

  async fetchVariantData() {
    try {
      const variantIds = this.campaignData.variant_ids;
      console.log('Variant IDs:', variantIds);
      
      // Only proceed if we have variant IDs
      if (!variantIds || !variantIds.length) {
        console.log('No variant IDs found');
        return;
      }
      
      const response = await fetch(`/variants/${variantIds[0]}?section_id=gift-modal`);
      const data = await response.json();
      console.log('Variant data:', data);
      
    } catch (error) {
      console.log('Error:', error.message);
    }
  }

  renderGiftOptions() {
    const giftOptionsContainer = this.querySelector('.gift-options');
    console.log('Gift options container:', giftOptionsContainer);
    console.log('Campaign data variants:', this.campaignData?.variants);
    
    if (!giftOptionsContainer || !this.campaignData?.variants) {
      console.log('Missing container or variants data');
      return;
    }

    const optionsHTML = this.campaignData.variants.map((variant, index) => `
      <div class="gift-option">
        <input 
          type="radio" 
          name="gift_choice" 
          id="gift-${variant.id}" 
          value="${variant.id}"
          ${index === 0 ? 'checked' : ''}
        >
        <label for="gift-${variant.id}">
          <img src="${variant.image}" alt="${variant.product_title}">
          <span class="gift-title">${variant.product_title} - ${variant.title}</span>
        </label>
      </div>
    `).join('');

    console.log('Generated HTML:', optionsHTML);
    giftOptionsContainer.innerHTML = optionsHTML;
  }

  bindEvents() {
    const checkoutButton = document.getElementById('checkout');
    
    if (checkoutButton) {
      checkoutButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.open();
      });
    }

    // Add close button handler
    this.querySelector('.gift-modal__close')?.addEventListener('click', () => {
      this.close();
    });
  }

  open() {
    this.modal.setAttribute('open', '');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
    
    // Set focus to the modal
    this.modal.focus();
  }

  close() {
    this.modal.removeAttribute('open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
    
    // Return focus to the checkout button
    document.getElementById('checkout')?.focus();
  }
}

customElements.define('gift-modal', GiftModal);
