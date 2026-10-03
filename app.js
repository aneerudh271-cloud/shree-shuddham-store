(() => {
  const backendEnabled = location.protocol !== 'file:';
  const apiRequest = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  };
  const storage = {
    read(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch (error) {
        console.error(`Unable to read demo store data (${key}).`, error);
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error(`Unable to save demo store data (${key}).`, error);
        showToast('This browser could not save the demo data. Check storage settings.');
        return false;
      }
    }
  };
  const toast = document.querySelector('#toast');
  const checkout = document.querySelector('#checkout-dialog');
  const checkoutContent = document.querySelector('#checkout-content');
  let toastTimer;
  let activeDiscount = 0;
  let activeCoupon = '';

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  function readInitialProducts() {
    return [...document.querySelectorAll('.product-card')].map((card, index) => ({
      id: `product-${index + 1}`,
      name: card.dataset.name.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      category: card.dataset.category,
      description: card.querySelector('.product-info > p').textContent,
      price: Number(card.querySelector('.price').childNodes[0].textContent.replace(/[^\d]/g, '')),
      unit: card.querySelector('.price small').textContent.replace(/^\s*\/\s*/, ''),
      image: card.querySelector('.product-photo img').src,
      alt: card.querySelector('.product-photo img').alt,
      badge: card.querySelector('.product-badge').textContent
    }));
  }

  let products = backendEnabled ? readInitialProducts() : storage.read('ss-demo-products', null) || readInitialProducts();
  let basket = storage.read('ss-basket', {});
  let coupons = storage.read('ss-demo-coupons', [
    { code: 'FRESH10', type: 'percent', value: 10, active: true },
    { code: 'WELCOME50', type: 'fixed', value: 50, active: true }
  ]);

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function renderProducts() {
    const grid = document.querySelector('#product-grid');
    grid.innerHTML = products.map((product) => `
      <article class="product-card" data-category="${escapeHtml(product.category)}" data-name="${escapeHtml(product.name.toLowerCase())}">
        <div class="product-photo">
          ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt || product.name)}" loading="lazy" width="600" height="520">` : '<div class="product-image-placeholder" aria-label="No product image">Image coming soon</div>'}
          <span class="product-badge">${escapeHtml(product.badge || 'Picked with care')}</span>
          <button class="save-button" type="button" aria-label="Save ${escapeHtml(product.name)}" aria-pressed="false">♡</button>
        </div>
        <div class="product-info">
          <span class="product-category">${escapeHtml(product.category.toUpperCase())}</span>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description)}</p>
          <div class="product-buy"><span class="price">₹${product.price} <small>/ ${escapeHtml(product.unit)}</small></span>
            <button class="add-button" data-product-id="${escapeHtml(product.id)}" type="button" aria-label="Add ${escapeHtml(product.name)} to basket">+</button>
          </div>
          <button class="subscribe-link" type="button" data-subscribe="${escapeHtml(product.name)}">↻ Set up a subscription</button>
        </div>
      </article>`).join('');
    grid.querySelectorAll('.add-button').forEach((button) => button.addEventListener('click', () => {
      basket[button.dataset.productId] = (basket[button.dataset.productId] || 0) + 1;
      storage.write('ss-basket', basket);
      updateCartCount();
      const product = products.find((item) => item.id === button.dataset.productId);
      showToast(`${product.name} added to your basket`);
      button.textContent = '✓';
      window.setTimeout(() => { button.textContent = '+'; }, 900);
    }));
    grid.querySelectorAll('.save-button').forEach((button) => button.addEventListener('click', () => {
      const saved = button.classList.toggle('is-saved');
      button.textContent = saved ? '♥' : '♡';
      button.setAttribute('aria-pressed', String(saved));
      showToast(saved ? 'Added to your favourites' : 'Removed from your favourites');
    }));
    grid.querySelectorAll('.subscribe-link').forEach((button) => button.addEventListener('click', () => {
      showToast(`Choose a delivery frequency for ${button.dataset.subscribe} when subscriptions are connected.`);
      document.querySelector('#subscriptions').scrollIntoView({ behavior: 'smooth' });
    }));
    filterProducts();
  }

  function updateCartCount() {
    const count = Object.values(basket).reduce((sum, quantity) => sum + quantity, 0);
    document.querySelector('#cart-count').textContent = String(count);
    document.querySelector('#cart-button').setAttribute('aria-label', `Shopping basket, ${count} ${count === 1 ? 'item' : 'items'}`);
  }

  function filterProducts() {
    const term = document.querySelector('#product-search').value.trim().toLowerCase();
    const category = document.querySelector('#category-filter').value;
    let visible = 0;
    document.querySelectorAll('.product-card').forEach((card) => {
      const matches = card.dataset.name.includes(term) && (category === 'all' || card.dataset.category === category);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    document.querySelector('#empty-state').hidden = visible > 0;
  }

  function basketLines() {
    return Object.entries(basket).map(([id, quantity]) => {
      const product = products.find((item) => item.id === id);
      return product ? { ...product, quantity } : null;
    }).filter(Boolean);
  }

  function orderTotals() {
    const subtotal = basketLines().reduce((sum, item) => sum + item.price * item.quantity, 0);
    const delivery = subtotal >= 499 || subtotal === 0 ? 0 : 40;
    const coupon = coupons.find((item) => item.code.toUpperCase() === activeCoupon && item.active);
    const couponValue = coupon
      ? (coupon.type === 'percent' ? Math.floor(subtotal * coupon.value / 100) : coupon.value)
      : activeDiscount;
    const discount = Math.min(couponValue, subtotal);
    return { subtotal, delivery, discount, total: subtotal + delivery - discount };
  }

  function totalsHtml() {
    const totals = orderTotals();
    return `<div class="order-totals">
      <div class="order-total-line"><span>Subtotal</span><span>₹${totals.subtotal}</span></div>
      <div class="order-total-line"><span>Delivery</span><span>${totals.delivery ? `₹${totals.delivery}` : 'Free'}</span></div>
      ${totals.discount ? `<div class="order-total-line"><span>Coupon (${escapeHtml(activeCoupon)})</span><span>−₹${totals.discount}</span></div>` : ''}
      <div class="order-total-line grand"><span>Total</span><span>₹${totals.total}</span></div>
    </div>`;
  }

  function openBasket() {
    activeDiscount = 0;
    activeCoupon = '';
    const prepareBasket = async () => {
      if (backendEnabled) {
        try {
          coupons = (await apiRequest('/api/coupons')).coupons;
        } catch (error) {
          console.error('Could not load available coupons.', error);
          showToast(error.message);
          return;
        }
      } else {
        coupons = storage.read('ss-demo-coupons', coupons);
      }
      renderBasket();
      checkout.showModal();
    };
    prepareBasket();
  }

  function renderBasket(prefill = {}) {
    const lines = basketLines();
    if (!lines.length) {
      checkoutContent.innerHTML = '<div class="checkout-empty">Your basket is empty. Find something fresh to get started.</div><a class="button button-primary" href="#shop" id="empty-shop-link">Browse the shop <span aria-hidden="true">→</span></a>';
      checkoutContent.querySelector('#empty-shop-link').addEventListener('click', () => checkout.close());
      return;
    }
    checkoutContent.innerHTML = `
      <div class="basket-lines">${lines.map((item) => `
        <div class="basket-line">
          <div><strong>${escapeHtml(item.name)}</strong><small>₹${item.price} / ${escapeHtml(item.unit)}</small></div>
          <div class="quantity-control" aria-label="${escapeHtml(item.name)} quantity">
            <button type="button" data-change="-1" data-id="${escapeHtml(item.id)}" aria-label="Decrease ${escapeHtml(item.name)} quantity">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-change="1" data-id="${escapeHtml(item.id)}" aria-label="Increase ${escapeHtml(item.name)} quantity">+</button>
          </div>
          <span class="basket-line-price">₹${item.price * item.quantity}</span>
        </div>`).join('')}</div>
      <form class="checkout-grid" id="order-form">
        <h3 class="slot-heading">Delivery details</h3>
        <label class="checkout-field">Full name<input name="name" autocomplete="name" value="${escapeHtml(prefill.name || '')}" required maxlength="100"></label>
        <label class="checkout-field">Mobile number<input name="phone" autocomplete="tel" inputmode="numeric" pattern="[0-9]{10,16}" value="${escapeHtml(prefill.phone || '')}" required></label>
        <label class="checkout-field wide">Email for your order record <span>(optional)</span><input name="email" type="email" autocomplete="email" value="${escapeHtml(prefill.email || '')}" maxlength="160"></label>
        <label class="checkout-field wide">House / flat and street<input name="addressLine1" autocomplete="address-line1" value="${escapeHtml(prefill.addressLine1 || '')}" required maxlength="160" placeholder="House / flat, building, street"></label>
        <label class="checkout-field wide">Area / locality<input name="area" autocomplete="address-line2" value="${escapeHtml(prefill.area || '')}" required maxlength="100" placeholder="Area or neighbourhood"></label>
        <label class="checkout-field">Landmark <span>(optional)</span><input name="landmark" value="${escapeHtml(prefill.landmark || '')}" maxlength="100"></label>
        <label class="checkout-field">City / town<input name="city" autocomplete="address-level2" value="${escapeHtml(prefill.city || '')}" required maxlength="80"></label>
        <label class="checkout-field">State<input name="state" autocomplete="address-level1" value="${escapeHtml(prefill.state || '')}" required maxlength="80"></label>
        <label class="checkout-field">PIN code<input name="pin" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" value="${escapeHtml(prefill.pin || '')}" required></label>
        <label class="checkout-field wide">Delivery instructions <span>(optional)</span><textarea name="instructions" maxlength="240" placeholder="Gate, floor, or delivery notes">${escapeHtml(prefill.instructions || '')}</textarea></label>
        <label class="checkout-field wide">Delivery day
          <select name="deliveryDay" required><option value="">Choose a day</option><option ${prefill.deliveryDay === 'Tomorrow' ? 'selected' : ''}>Tomorrow</option><option ${prefill.deliveryDay === 'Day after tomorrow' ? 'selected' : ''}>Day after tomorrow</option><option ${prefill.deliveryDay === 'Choose a date with admin' ? 'selected' : ''}>Choose a date with admin</option></select>
        </label>
        <label class="checkout-field wide">Delivery slot
          <select name="deliverySlot" required><option value="">Choose a delivery slot</option><option ${prefill.deliverySlot === '5:00 AM – 7:00 AM' ? 'selected' : ''}>5:00 AM – 7:00 AM</option><option ${prefill.deliverySlot === '7:00 AM – 9:00 AM' ? 'selected' : ''}>7:00 AM – 9:00 AM</option><option ${prefill.deliverySlot === '9:00 AM – 12:00 PM' ? 'selected' : ''}>9:00 AM – 12:00 PM</option><option ${prefill.deliverySlot === '12:00 PM – 3:00 PM' ? 'selected' : ''}>12:00 PM – 3:00 PM</option><option ${prefill.deliverySlot === '3:00 PM – 6:00 PM' ? 'selected' : ''}>3:00 PM – 6:00 PM</option><option ${prefill.deliverySlot === '6:00 PM – 9:00 PM' ? 'selected' : ''}>6:00 PM – 9:00 PM</option></select>
        </label>
        <div class="checkout-field wide"><span>Coupon code</span><div class="coupon-row"><input id="coupon-code" autocomplete="off" placeholder="Enter coupon code"><button id="apply-coupon" type="button">Apply</button></div><p class="coupon-message" id="coupon-message" aria-live="polite"></p></div>
        <div class="checkout-field wide" id="totals-container">${totalsHtml()}</div>
        <button class="button button-primary checkout-submit checkout-field wide" type="submit">Continue to demo payment <span aria-hidden="true">→</span></button>
      </form>`;
    checkoutContent.querySelectorAll('.quantity-control button').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.id;
      basket[id] = (basket[id] || 0) + Number(button.dataset.change);
      if (basket[id] <= 0) delete basket[id];
      storage.write('ss-basket', basket);
      updateCartCount();
      const form = checkoutContent.querySelector('#order-form');
      const prefill = form ? Object.fromEntries(new FormData(form).entries()) : {};
      renderBasket(prefill);
    }));
    checkoutContent.querySelector('#apply-coupon').addEventListener('click', applyCoupon);
    checkoutContent.querySelector('#order-form').addEventListener('submit', submitOrder);
  }

  async function applyCoupon() {
    const input = checkoutContent.querySelector('#coupon-code');
    if (backendEnabled) {
      try {
        coupons = (await apiRequest('/api/coupons')).coupons;
      } catch (error) {
        showToast(error.message);
        return;
      }
    }
    const coupon = coupons.find((item) => item.code.toUpperCase() === input.value.trim().toUpperCase() && item.active);
    const message = checkoutContent.querySelector('#coupon-message');
    if (!coupon) {
      activeDiscount = 0;
      activeCoupon = '';
      message.textContent = 'That code is not active or valid.';
      message.style.color = '#a14e43';
    } else {
      const subtotal = orderTotals().subtotal;
      activeDiscount = coupon.type === 'percent' ? Math.floor(subtotal * coupon.value / 100) : coupon.value;
      activeCoupon = coupon.code;
      message.textContent = `${coupon.code} applied — you save ₹${activeDiscount}.`;
      message.style.color = '#63805b';
    }
    checkoutContent.querySelector('#totals-container').innerHTML = totalsHtml();
  }

  async function submitOrder(event) {
    event.preventDefault();
    event.currentTarget.querySelectorAll('input, textarea').forEach((field) => {
      if (field.value) field.value = field.value.trim();
    });
    if (!event.currentTarget.reportValidity()) return;
    const formData = new FormData(event.currentTarget);
    const customer = Object.fromEntries(formData.entries());
    const totals = orderTotals();
    const lines = basketLines();
    if (backendEnabled) {
      try {
        const availability = await apiRequest(`/api/pincodes?pin=${encodeURIComponent(customer.pin)}`);
        if (!availability.serviceable) {
          showToast('We do not currently deliver to that PIN code.');
          return;
        }
        const { order } = await apiRequest('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            customer,
            items: lines.map((item) => ({ productId: item.id, quantity: item.quantity })),
            couponCode: activeCoupon
          })
        });
        renderDemoPayment(order);
      } catch (error) {
        console.error('Order could not be created.', error);
        showToast(error.message);
      }
      return;
    }
    const supportedPins = storage.read('ss-demo-pincodes', []);
    if (!supportedPins.some((item) => item.pin === customer.pin && item.active)) {
      showToast('We do not currently deliver to that PIN code.');
      return;
    }
    renderDemoPayment({ customer, items: lines, ...totals, coupon: activeCoupon });
  }

  function renderDemoPayment(draft) {
    checkoutContent.innerHTML = `
      <div class="payment-notice"><strong>Razorpay test-mode placeholder.</strong> This checkout is simulated only: no Razorpay API is connected, and no payment details or money are collected. Use fictional customer information only.</div>
      <div class="payment-review">
        <h3>Review your payment</h3>
        <p><strong>${escapeHtml(draft.customer.name)}</strong><br>${escapeHtml(formatAddress(draft.customer))}<br>${escapeHtml(draft.deliveryDay || draft.customer.deliveryDay)} · ${escapeHtml(draft.deliverySlot || draft.customer.deliverySlot)}</p>
        <div class="order-total-line grand"><span>Amount due</span><span>₹${draft.total}</span></div>
        <label class="checkout-field payment-method">Demo payment method<select id="demo-payment-method"><option>UPI (simulated)</option><option>Card (simulated)</option><option>Net banking (simulated)</option><option>Wallet (simulated)</option></select></label>
        <div class="confirmation-actions"><button class="button button-primary" id="complete-demo-payment" type="button">Pay with Razorpay demo <span aria-hidden="true">→</span></button><button class="button button-outline" id="back-to-delivery" type="button">Back to delivery details</button></div>
      </div>`;
    checkoutContent.querySelector('#complete-demo-payment').addEventListener('click', () => completeDemoPayment(draft, checkoutContent.querySelector('#demo-payment-method').value));
    checkoutContent.querySelector('#back-to-delivery').addEventListener('click', () => renderBasket(draft.customer));
  }

  async function completeDemoPayment(draft, paymentMethod) {
    if (backendEnabled) {
      const button = checkoutContent.querySelector('#complete-demo-payment');
      button.disabled = true;
      button.textContent = 'Starting demo payment…';
      try {
        const { order } = await apiRequest(`/api/orders/${encodeURIComponent(draft.id)}/demo-payment`, {
          method: 'POST',
          body: JSON.stringify({ paymentMethod })
        });
        basket = {};
        storage.write('ss-basket', basket);
        updateCartCount();
        renderConfirmation(order);
      } catch (error) {
        console.error('Demo payment initiation failed.', error);
        showToast(error.message);
        button.disabled = false;
        button.innerHTML = 'Pay with Razorpay demo <span aria-hidden="true">→</span>';
      }
      return;
    }
    const order = {
      id: `SS-${Date.now().toString().slice(-8)}`,
      customer: draft.customer, items: draft.items, subtotal: draft.subtotal,
      delivery: draft.delivery, discount: draft.discount, total: draft.total,
      coupon: draft.coupon, paymentMethod, status: 'Awaiting admin review',
      paymentStatus: 'Demo payment initiated - no charge',
      deliveryDate: draft.customer.deliveryDay,
      deliverySlot: draft.customer.deliverySlot,
      createdAt: new Date().toISOString()
    };
    const orders = storage.read('ss-demo-orders', []);
    orders.unshift(order);
    if (!storage.write('ss-demo-orders', orders)) return;
    basket = {};
    storage.write('ss-basket', basket);
    updateCartCount();
    renderConfirmation(order);
  }

  function formatAddress(customer) {
    const address = [
      customer.addressLine1 || customer.address,
      customer.area,
      customer.landmark ? `Near ${customer.landmark}` : '',
      [customer.city, customer.state].filter(Boolean).join(', '),
      customer.pin ? `PIN ${customer.pin}` : ''
    ].filter(Boolean).join(', ');
    return [address, customer.instructions ? `Delivery notes: ${customer.instructions}` : ''].filter(Boolean).join('. ');
  }

  function pdfSafe(value) {
    return String(value).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/[\\()]/g, '\\$&');
  }

  function wrapPdfText(value, limit = 78) {
    const words = pdfSafe(value).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      if (!word) return;
      if (line && `${line} ${word}`.length > limit) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function createInvoicePages(order) {
    const pageHeight = 842;
    const pageWidth = 595;
    const pages = [];
    let commands = [];
    let y = 0;
    const text = (x, top, value, size = 9, font = 'F1', color = '0.18 0.29 0.21') => {
      commands.push(`${color} rg BT /${font} ${size} Tf ${x} ${pageHeight - top} Td (${pdfSafe(value)}) Tj ET`);
    };
    const rule = (x1, top1, x2, top2, color = '0.87 0.89 0.84', width = 0.7) => {
      commands.push(`${color} RG ${width} w ${x1} ${pageHeight - top1} m ${x2} ${pageHeight - top2} l S`);
    };
    const rect = (x, top, width, height, fill) => {
      commands.push(`${fill} rg ${x} ${pageHeight - top - height} ${width} ${height} re f`);
    };
    const block = (x, top, value, size = 9, limit = 38, color = '0.31 0.35 0.30') => {
      const rows = wrapPdfText(value, limit);
      rows.forEach((line, index) => text(x, top + index * 13, line, size, 'F1', color));
      return top + rows.length * 13;
    };
    const startPage = (continued = false) => {
      commands = [];
      rect(0, 0, pageWidth, 8, '0.15 0.29 0.21');
      commands.push(`q 90 0 0 86 36 ${pageHeight - 22 - 86} cm /Logo Do Q`);
      text(145, 42, 'SHREE SHUDDHAM', 18, 'F2');
      text(145, 60, 'SHUDDHATA KI PARAMPARA', 8, 'F2', '0.60 0.47 0.25');
      text(145, 76, 'FRESH FARM-TO-HOME ESSENTIALS', 7, 'F1', '0.45 0.49 0.43');
      text(420, 38, continued ? 'INVOICE (CONTINUED)' : 'ORDER INVOICE', 9, 'F2');
      text(420, 55, 'Order ID', 7, 'F2');
      text(420, 66, order.id, 6);
      text(420, 82, `Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 8);
      rule(36, 106, 559, 106, '0.76 0.80 0.73', 1);
      if (!continued) {
        text(40, 131, 'CUSTOMER', 8, 'F2', '0.60 0.47 0.25');
        text(315, 131, 'DELIVER TO', 8, 'F2', '0.60 0.47 0.25');
        let customerY = block(40, 149, order.customer.name, 10, 41, '0.15 0.29 0.20');
        customerY = block(40, customerY, `Phone: ${order.customer.phone}`, 8, 45);
        if (order.customer.email) customerY = block(40, customerY, `Email: ${order.customer.email}`, 8, 43);
        let addressY = block(315, 149, order.customer.name, 10, 37, '0.15 0.29 0.20');
        [
          order.customer.addressLine1 || order.customer.address,
          order.customer.area,
          order.customer.landmark ? `Near ${order.customer.landmark}` : '',
          [order.customer.city, order.customer.state].filter(Boolean).join(', '),
          order.customer.pin ? `PIN: ${order.customer.pin}` : ''
        ].filter(Boolean).forEach((line) => { addressY = block(315, addressY, line, 8, 38); });
        if (order.customer.instructions) addressY = block(315, addressY, `Note: ${order.customer.instructions}`, 7, 40, '0.43 0.47 0.42');
        const deliveryTop = Math.max(customerY, addressY) + 18;
        text(40, deliveryTop, `DELIVERY: ${order.deliveryDate} | ${order.deliverySlot}`, 8, 'F2');
        text(315, deliveryTop, `PAYMENT: ${order.paymentMethod || 'Demo'}`, 8, 'F2');
        const tableTop = deliveryTop + 15;
        rect(36, tableTop, 523, 25, '0.91 0.94 0.89');
        text(44, tableTop + 16, 'ITEM', 8, 'F2');
        text(348, tableTop + 16, 'QTY', 8, 'F2');
        text(408, tableTop + 16, 'UNIT PRICE', 8, 'F2');
        text(501, tableTop + 16, 'AMOUNT', 8, 'F2');
        y = tableTop + 43;
      } else {
        rect(36, 122, 523, 25, '0.91 0.94 0.89');
        text(44, 138, 'ITEM (CONTINUED)', 8, 'F2');
        text(348, 138, 'QTY', 8, 'F2');
        text(408, 138, 'UNIT PRICE', 8, 'F2');
        text(501, 138, 'AMOUNT', 8, 'F2');
        y = 165;
      }
    };
    const finishPage = () => pages.push(commands.join('\n'));
    startPage();
    order.items.forEach((item) => {
      const nameLines = wrapPdfText(`${item.name} / ${item.unit}`, 46);
      const rowHeight = Math.max(32, nameLines.length * 11 + 18);
      if (y + rowHeight > 660) {
        finishPage();
        startPage(true);
      }
      nameLines.forEach((line, index) => text(44, y + index * 11, line, 8));
      text(352, y, String(item.quantity), 8);
      text(408, y, `INR ${item.price}`, 8);
      text(501, y, `INR ${item.price * item.quantity}`, 8, 'F2');
      y += rowHeight;
      rule(40, y - 7, 555, y - 7);
    });
    if (y > 635) {
      finishPage();
      startPage(true);
    }
    const totalsTop = Math.max(y + 14, 300);
    text(363, totalsTop, `Subtotal: INR ${order.subtotal}`, 9);
    text(363, totalsTop + 17, `Delivery: ${order.delivery ? `INR ${order.delivery}` : 'Free'}`, 9);
    if (order.discount) text(363, totalsTop + 34, `Discount${order.coupon ? ` (${order.coupon})` : ''}: -INR ${order.discount}`, 9, 'F1', '0.31 0.48 0.30');
    const totalTop = totalsTop + (order.discount ? 58 : 41);
    rule(357, totalTop - 13, 555, totalTop - 13, '0.76 0.80 0.73', 1);
    text(363, totalTop + 4, `TOTAL: INR ${order.total}`, 13, 'F2');
    text(40, totalTop + 30, 'Thank you for choosing Shree Shuddham.', 9, 'F2', '0.15 0.29 0.20');
    text(40, totalTop + 46, 'A little more care in every delivery.', 8, 'F1', '0.45 0.49 0.43');
    const sealTop = totalTop + 18;
    const circle = (radius) => {
      const centerX = 511;
      const centerY = pageHeight - sealTop;
      const k = radius * 0.55228475;
      return `${centerX + radius} ${centerY} m ${centerX + radius} ${centerY + k} ${centerX + k} ${centerY + radius} ${centerX} ${centerY + radius} c ${centerX - k} ${centerY + radius} ${centerX - radius} ${centerY + k} ${centerX - radius} ${centerY} c ${centerX - radius} ${centerY - k} ${centerX - k} ${centerY - radius} ${centerX} ${centerY - radius} c ${centerX + k} ${centerY - radius} ${centerX + radius} ${centerY - k} ${centerX + radius} ${centerY} h`;
    };
    commands.push(`0.72 0.55 0.25 RG 1.2 w ${circle(18)} S`);
    commands.push(`0.84 0.70 0.39 RG 0.6 w ${circle(15)} S`);
    text(470, sealTop - 5, 'SHUDDHAM', 6, 'F2', '0.48 0.37 0.18');
    text(466, sealTop + 5, 'ORDER RECEIVED', 5, 'F2', '0.48 0.37 0.18');
    text(470, sealTop + 14, 'DEMO PAYMENT', 5, 'F2', '0.48 0.37 0.18');
    text(40, 802, 'DEMO INVOICE - NO REAL PAYMENT COLLECTED - NOT A TAX INVOICE', 7, 'F2', '0.59 0.42 0.25');
    finishPage();
    return pages;
  }

  function downloadInvoice(order) {
    const encoder = new TextEncoder();
    const logoImage = document.querySelector('.footer-logo') || document.querySelector('.header-main .brand-logo');
    if (!logoImage || !logoImage.complete || !logoImage.naturalWidth) throw new Error('The Shree Shuddham logo is not loaded.');
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 340;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the invoice logo.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(logoImage, 0, 0, canvas.width, canvas.height);
    const jpegUrl = canvas.toDataURL('image/jpeg', 0.86);
    const logoBytes = Uint8Array.from(atob(jpegUrl.split(',')[1]), (character) => character.charCodeAt(0));
    const pages = createInvoicePages(order);
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${pages.map((_, index) => `${6 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
      null
    ];
    pages.forEach((pageContent, index) => {
      const pageId = 6 + index * 2;
      const contentId = pageId + 1;
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents ${contentId} 0 R >>`);
      objects.push({ stream: encoder.encode(pageContent) });
    });
    const chunks = ['%PDF-1.4\n'];
    const offsets = [];
    let byteOffset = encoder.encode(chunks[0]).length;
    objects.forEach((object, index) => {
      offsets.push(byteOffset);
      let objectParts;
      if (index === 4) {
        objectParts = [`5 0 obj\n<< /Type /XObject /Subtype /Image /Width 360 /Height 340 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`, logoBytes, '\nendstream\nendobj\n'];
      } else if (typeof object === 'object') {
        objectParts = [`${index + 1} 0 obj\n<< /Length ${object.stream.length} >>\nstream\n`, object.stream, '\nendstream\nendobj\n'];
      } else {
        objectParts = [`${index + 1} 0 obj\n${object}\nendobj\n`];
      }
      chunks.push(...objectParts);
      byteOffset += objectParts.reduce((sum, part) => sum + (typeof part === 'string' ? encoder.encode(part).length : part.length), 0);
    });
    const xrefOffset = byteOffset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => { xref += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(xref);
    const pdfBytes = new Uint8Array(chunks.reduce((sum, part) => sum + (typeof part === 'string' ? encoder.encode(part).length : part.length), 0));
    let cursor = 0;
    chunks.forEach((part) => {
      const bytes = typeof part === 'string' ? encoder.encode(part) : part;
      pdfBytes.set(bytes, cursor);
      cursor += bytes.length;
    });
    const url = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `invoice-${order.id}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderConfirmation(order) {
    checkoutContent.innerHTML = `
      <div class="payment-notice"><strong>Razorpay test mode placeholder.</strong> No Razorpay API is connected and no money has been charged. This demo records an order only in this browser; use fictional information only.</div>
      <div class="confirmation-box">
        <span class="confirmation-mark" aria-hidden="true">✓</span>
        <h3>Demo payment initiated</h3>
        <p>Order <strong>${escapeHtml(order.id)}</strong><br>Delivery: ${escapeHtml(order.deliveryDate)} · ${escapeHtml(order.deliverySlot)}<br>Total: ₹${order.total}<br>Payment is simulated only. Your order is awaiting admin review.</p>
        <div class="confirmation-actions"><button class="button button-primary" id="download-invoice" type="button">Download demo invoice PDF <span aria-hidden="true">↓</span></button><button class="button button-outline" id="close-confirmation" type="button">Continue shopping</button></div>
      </div>`;
    checkoutContent.querySelector('#download-invoice').addEventListener('click', () => {
      try {
        downloadInvoice(order);
      } catch (error) {
        console.error('Invoice PDF generation failed.', error);
        showToast('Could not generate the invoice PDF. Please try again.');
      }
    });
    checkoutContent.querySelector('#close-confirmation').addEventListener('click', () => checkout.close());
  }

  const menuToggle = document.querySelector('#menu-toggle');
  const nav = document.querySelector('#primary-nav');
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    menuToggle.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
    nav.classList.toggle('is-open', !expanded);
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
  }));
  document.querySelector('#product-search').addEventListener('input', filterProducts);
  document.querySelector('#category-filter').addEventListener('change', filterProducts);
  document.querySelectorAll('.category-card').forEach((card) => card.addEventListener('click', () => {
    const category = card.dataset.category === 'Bread & Bakery' ? 'Bakery' : card.dataset.category;
    document.querySelector('#category-filter').value = category;
    window.setTimeout(filterProducts, 0);
  }));
  document.querySelector('#cart-button').addEventListener('click', openBasket);
  document.querySelector('#close-checkout').addEventListener('click', () => checkout.close());
  checkout.addEventListener('click', (event) => { if (event.target === checkout) checkout.close(); });
  document.querySelector('#account-button').addEventListener('click', () => showToast('Customer sign-in will be available when accounts are connected.'));
  document.querySelector('#mobile-account-button').addEventListener('click', () => showToast('Customer sign-in will be available when accounts are connected.'));

  document.querySelector('#check-pin').addEventListener('click', async () => {
    const pin = document.querySelector('#pincode').value.trim();
    if (!/^\d{6}$/.test(pin)) {
      showToast('Please enter a valid 6-digit PIN code.');
      return;
    }
    const button = document.querySelector('#check-pin');
    button.disabled = true;
    try {
      const available = backendEnabled
        ? (await apiRequest(`/api/pincodes?pin=${encodeURIComponent(pin)}`)).serviceable
        : storage.read('ss-demo-pincodes', []).some((item) => item.pin === pin && item.active);
      showToast(available ? 'Great — delivery is available for this PIN code.' : 'We do not currently deliver to that PIN code.');
    } catch (error) {
      console.error('Delivery area could not be checked.', error);
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });
  document.querySelector('#newsletter-form').addEventListener('submit', (event) => {
    event.preventDefault();
    showToast('Thanks for joining us. Newsletter sign-up will be connected soon.');
    event.currentTarget.reset();
  });
  document.querySelector('#year').textContent = String(new Date().getFullYear());
  renderProducts();
  updateCartCount();
  if (backendEnabled) {
    apiRequest('/api/products').then(({ products: currentProducts }) => {
      products = currentProducts;
      renderProducts();
    }).catch((error) => {
      console.error('Could not load the product catalogue.', error);
      showToast('The shop catalogue could not be loaded. Please refresh in a moment.');
    });
  }
})();
