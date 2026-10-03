(() => {
  const KEY = {
    products: 'ss-demo-products',
    orders: 'ss-demo-orders',
    coupons: 'ss-demo-coupons',
    username: 'ss-demo-admin-name',
    session: 'ss-demo-admin-session'
  };
  const localDemoAllowed = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const defaultProducts = [
    { id: 'product-1', name: 'Fresh Cow Milk', category: 'Milk & Dairy', description: 'Gentle, creamy goodness for your morning ritual.', price: 68, unit: '1 L', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=78', alt: 'Fresh cow milk in a clear glass bottle', badge: 'Daily favourite' },
    { id: 'product-2', name: 'Farm Fresh Tomatoes', category: 'Vegetables', description: 'Bright, juicy and ready for your favourite recipes.', price: 42, unit: '500 g', image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=600&q=78', alt: 'Ripe red tomatoes picked fresh', badge: 'In season' },
    { id: 'product-3', name: 'Seasonal Mangoes', category: 'Fruits', description: 'Sun-kissed sweetness to share around the table.', price: 149, unit: '1 kg', image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=78', alt: 'Golden ripe mangoes', badge: 'Seasonal pick' },
    { id: 'product-4', name: 'Country Sourdough Loaf', category: 'Bakery', description: 'A slow-made loaf with a crisp, golden crust.', price: 120, unit: 'loaf', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=78', alt: 'Golden country loaf', badge: 'Freshly baked' }
  ];
  let toastTimer;
  const $ = (selector) => document.querySelector(selector);
  const backendEnabled = location.protocol !== 'file:';
  if (backendEnabled) {
    void initBackendAdmin();
    return;
  }

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error(`Unable to read local demo data (${key}).`, error);
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Unable to save local demo data (${key}).`, error);
      notify('Could not save demo data. Browser storage may be full.');
      return false;
    }
  }
  function notify(message) {
    const toast = $('#admin-toast');
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2800);
  }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }
  function addressText(customer) {
    const parts = [
      customer.addressLine1 || customer.address,
      customer.area,
      customer.landmark ? `Near ${customer.landmark}` : '',
      [customer.city, customer.state].filter(Boolean).join(', '),
      customer.pin ? `PIN ${customer.pin}` : ''
    ].filter(Boolean);
    if (customer.instructions) parts.push(`Delivery notes: ${customer.instructions}`);
    return parts.join(', ');
  }
  function loadProducts() { return read(KEY.products, defaultProducts); }
  function loadOrders() { return read(KEY.orders, []); }
  function loadCoupons() { return read(KEY.coupons, [{ code: 'FRESH10', type: 'percent', value: 10, active: true }, { code: 'WELCOME50', type: 'fixed', value: 50, active: true }]); }

  function showDashboard() {
    $('#admin-login').hidden = true;
    $('#admin-app').hidden = false;
    $('#admin-current-user').textContent = read(KEY.username, 'Demo Admin');
    $('#admin-name-heading').textContent = `${read(KEY.username, 'Admin')}.`;
    $('#settings-form').elements.username.value = read(KEY.username, 'Demo Admin');
    renderAll();
  }

  function renderAll() {
    renderOrders();
    renderProducts();
    renderCoupons();
    renderPincodes();
    const orders = loadOrders();
    $('#metric-pending').textContent = String(orders.filter((order) => order.status === 'Awaiting admin review').length);
    $('#metric-products').textContent = String(loadProducts().length);
    $('#metric-coupons').textContent = String(loadCoupons().filter((coupon) => coupon.active).length);
    $('#metric-revenue').textContent = `₹${orders.filter((order) => order.status !== 'Declined' && order.status !== 'Awaiting admin review').reduce((total, order) => total + order.total, 0)}`;
  }

  function renderOrders() {
    const orders = loadOrders();
    $('#orders-empty').hidden = orders.length > 0;
    $('#orders-table').innerHTML = orders.map((order) => `
      <tr>
        <td><strong>${esc(order.id)}</strong><br>${esc(order.customer.name)}<br>${esc(order.customer.phone)}${order.customer.email ? `<br>${esc(order.customer.email)}` : ''}<br>${esc(addressText(order.customer))}</td>
        <td>${esc(order.deliveryDate)}<br>${esc(order.deliverySlot)}${order.deliveryAgent ? `<br>Agent: ${esc(order.deliveryAgent)}` : ''}</td>
        <td>${order.items.map((item) => `${esc(item.name)} × ${item.quantity}`).join('<br>')}<br><strong>Total ₹${order.total}</strong></td>
        <td>${esc(order.paymentStatus)}<br>Not a real charge</td>
        <td><span class="order-state ${order.status !== 'Awaiting admin review' && order.status !== 'Declined' ? 'accepted' : order.status === 'Declined' ? 'declined' : ''}">${esc(order.status)}</span>
          ${order.status === 'Awaiting admin review' ? `<div class="table-actions"><button data-order="${esc(order.id)}" data-status="Accepted">Accept</button><button class="danger" data-order="${esc(order.id)}" data-status="Declined">Decline</button></div>` : order.status === 'Declined' ? 'Order declined' : `<label class="admin-field delivery-status-field">Delivery status<select data-delivery-status="${esc(order.id)}"><option ${order.status === 'Accepted' ? 'selected' : ''}>Accepted</option><option ${order.status === 'Preparing' ? 'selected' : ''}>Preparing</option><option ${order.status === 'Packed' ? 'selected' : ''}>Packed</option><option ${order.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option><option ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option></select></label><label class="admin-field delivery-status-field">Delivery agent<input data-delivery-agent="${esc(order.id)}" value="${esc(order.deliveryAgent || '')}" maxlength="80"></label><button class="admin-button delivery-save" data-save-delivery="${esc(order.id)}" type="button">Save delivery update</button>`}
        </td>
      </tr>`).join('');
    $('#orders-table').querySelectorAll('button[data-order]').forEach((button) => button.addEventListener('click', () => {
      const updated = loadOrders().map((order) => order.id === button.dataset.order ? { ...order, status: button.dataset.status } : order);
      if (write(KEY.orders, updated)) {
        renderAll();
        notify(`Order ${button.dataset.order} ${button.dataset.status.toLowerCase()}.`);
      }
    }));
    $('#orders-table').querySelectorAll('[data-save-delivery]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.saveDelivery;
      const status = $('#orders-table').querySelector(`[data-delivery-status="${CSS.escape(id)}"]`).value;
      const agent = $('#orders-table').querySelector(`[data-delivery-agent="${CSS.escape(id)}"]`).value.trim();
      const updated = loadOrders().map((order) => order.id === id ? { ...order, status, deliveryAgent: agent } : order);
      if (write(KEY.orders, updated)) {
        renderAll();
        notify(`Delivery updated for ${id}.`);
      }
    }));
  }

  function renderProducts() {
    $('#products-table').innerHTML = loadProducts().map((product) => `
      <tr>
        <td><strong>${esc(product.name)}</strong><br>${esc(product.description)}</td>
        <td>${esc(product.category)}</td><td>₹${product.price} / ${esc(product.unit)}</td>
        <td>${product.image ? `<img src="${esc(product.image)}" alt="${esc(product.alt || product.name)}">` : 'No image'}</td>
        <td><div class="table-actions"><button data-edit-product="${esc(product.id)}">Edit</button><button class="danger" data-remove-product="${esc(product.id)}">Remove</button></div></td>
      </tr>`).join('');
    $('#products-table').querySelectorAll('[data-edit-product]').forEach((button) => button.addEventListener('click', () => editProduct(button.dataset.editProduct)));
    $('#products-table').querySelectorAll('[data-remove-product]').forEach((button) => button.addEventListener('click', () => {
      const kept = loadProducts().filter((product) => product.id !== button.dataset.removeProduct);
      if (write(KEY.products, kept)) { renderAll(); notify('Product removed from the demo catalogue.'); }
    }));
  }

  function editProduct(id) {
    const product = loadProducts().find((item) => item.id === id);
    if (!product) return;
    const form = $('#product-form');
    ['id', 'name', 'category', 'price', 'unit', 'description', 'image', 'alt'].forEach((key) => {
      if (form.elements[key]) form.elements[key].value = product[key] ?? '';
    });
    $('#save-product').innerHTML = 'Save changes <span aria-hidden="true">→</span>';
    $('#cancel-product-edit').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderCoupons() {
    $('#coupons-table').innerHTML = loadCoupons().map((coupon) => `
      <tr><td><strong>${esc(coupon.code)}</strong></td><td>${coupon.type === 'percent' ? `${coupon.value}% off` : `₹${coupon.value} off`}</td><td>${coupon.active ? 'Active' : 'Disabled'}</td>
      <td><div class="table-actions"><button data-toggle-coupon="${esc(coupon.code)}">${coupon.active ? 'Disable' : 'Enable'}</button><button class="danger" data-delete-coupon="${esc(coupon.code)}">Delete</button></div></td></tr>`).join('');
    $('#coupons-table').querySelectorAll('[data-toggle-coupon]').forEach((button) => button.addEventListener('click', () => {
      const updated = loadCoupons().map((coupon) => coupon.code === button.dataset.toggleCoupon ? { ...coupon, active: !coupon.active } : coupon);
      if (write(KEY.coupons, updated)) renderAll();
    }));
    $('#coupons-table').querySelectorAll('[data-delete-coupon]').forEach((button) => button.addEventListener('click', () => {
      const updated = loadCoupons().filter((coupon) => coupon.code !== button.dataset.deleteCoupon);
      if (write(KEY.coupons, updated)) { renderAll(); notify('Coupon removed.'); }
    }));
  }

  function renderPincodes() {
    const pincodes = read('ss-demo-pincodes', []);
    $('#pincodes-empty').hidden = pincodes.length > 0;
    $('#pincodes-table').innerHTML = pincodes.map((item) => `
      <tr><td><strong>${esc(item.pin)}</strong></td><td>${esc(item.label || '—')}</td><td>${item.active ? 'Active' : 'Inactive'}</td>
      <td><div class="table-actions"><button data-toggle-pincode="${esc(item.pin)}">${item.active ? 'Deactivate' : 'Activate'}</button><button class="danger" data-delete-pincode="${esc(item.pin)}">Remove</button></div></td></tr>`).join('');
    $('#pincodes-table').querySelectorAll('[data-toggle-pincode]').forEach((button) => button.addEventListener('click', () => {
      const updated = read('ss-demo-pincodes', []).map((item) => item.pin === button.dataset.togglePincode ? { ...item, active: !item.active } : item);
      if (write('ss-demo-pincodes', updated)) renderAll();
    }));
    $('#pincodes-table').querySelectorAll('[data-delete-pincode]').forEach((button) => button.addEventListener('click', () => {
      const updated = read('ss-demo-pincodes', []).filter((item) => item.pin !== button.dataset.deletePincode);
      if (write('ss-demo-pincodes', updated)) { renderAll(); notify('PIN code removed.'); }
    }));
  }

  $('#admin-login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!localDemoAllowed) {
      $('#admin-login-message').textContent = 'Demo login is disabled on public hosts. Configure secure server-side authentication before publishing admin access.';
      return;
    }
    if (!event.currentTarget.reportValidity()) return;
    sessionStorage.setItem(KEY.session, 'demo-only');
    const current = read(KEY.username, null);
    if (!current) write(KEY.username, $('#admin-login-id').value.trim());
    showDashboard();
  });
  $('#admin-logout').addEventListener('click', () => {
    sessionStorage.removeItem(KEY.session);
    $('#admin-app').hidden = true;
    $('#admin-login').hidden = false;
    $('#admin-login-form').reset();
  });
  $('#refresh-admin').addEventListener('click', renderAll);
  $('#product-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const id = data.get('id') || `product-${crypto.randomUUID()}`;
    const entry = {
      id, name: String(data.get('name')).trim(), category: String(data.get('category')),
      description: String(data.get('description')).trim(), price: Number(data.get('price')),
      unit: String(data.get('unit')).trim(), image: String(data.get('image')).trim(),
      alt: String(data.get('alt')).trim() || String(data.get('name')).trim(), badge: 'Picked with care'
    };
    if (entry.image && !/^https:\/\//i.test(entry.image)) {
      notify('Use an HTTPS image URL, or leave the image blank.');
      return;
    }
    const items = loadProducts();
    const existingIndex = items.findIndex((product) => product.id === id);
    if (existingIndex >= 0) items[existingIndex] = { ...items[existingIndex], ...entry };
    else items.push(entry);
    if (write(KEY.products, items)) {
      form.reset();
      form.elements.id.value = '';
      resetProductEditor();
      renderAll();
      notify(existingIndex >= 0 ? 'Product updated in the demo catalogue.' : 'Product added to the demo catalogue.');
    }
  });
  function resetProductEditor() {
    $('#save-product').innerHTML = 'Add product <span aria-hidden="true">+</span>';
    $('#cancel-product-edit').hidden = true;
  }
  $('#cancel-product-edit').addEventListener('click', () => { $('#product-form').reset(); $('#product-form').elements.id.value = ''; resetProductEditor(); });
  $('#coupon-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const type = String(data.get('type'));
    const value = Number(data.get('value'));
    if (!Number.isInteger(value) || value < 1 || (type === 'percent' && value > 100)) {
      notify(type === 'percent' ? 'Percentage must be from 1 to 100.' : 'Enter a valid whole-number discount.');
      return;
    }
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const code = `SHUD${[...bytes].map((byte) => (byte % 36).toString(36)).join('').toUpperCase()}`;
    if (write(KEY.coupons, [...loadCoupons(), { code, type, value, active: true }])) {
      renderAll();
      notify(`Generated coupon ${code}.`);
    }
  });
  $('#pincode-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const pin = String(data.get('pin')).trim();
    const pincodes = read('ss-demo-pincodes', []);
    if (pincodes.some((item) => item.pin === pin)) {
      notify('That PIN code is already on the service-area list.');
      return;
    }
    if (write('ss-demo-pincodes', [...pincodes, { pin, label: String(data.get('label')).trim(), active: true }])) {
      form.reset();
      renderAll();
      notify(`PIN code ${pin} added and activated.`);
    }
  });
  $('#settings-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const username = event.currentTarget.elements.username.value.trim();
    write(KEY.username, username);
    $('#admin-current-user').textContent = username;
    $('#admin-name-heading').textContent = `${username}.`;
    notify('Demo admin ID updated for this browser.');
  });

  if (localDemoAllowed && sessionStorage.getItem(KEY.session) === 'demo-only') showDashboard();

  async function initBackendAdmin() {
    const request = async (path, options = {}) => {
      const response = await fetch(path, {
        ...options,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) showLogin();
        throw new Error(payload.error || `Request failed (${response.status}).`);
      }
      return payload;
    };
    const announce = (message) => {
      const toast = $('#admin-toast');
      toast.textContent = message;
      toast.classList.add('visible');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3000);
    };
    const loadDashboard = async () => {
      adminOrderCursor = '';
      adminOrders = [];
      return loadDashboardPage(false);
    };
    let adminOrderCursor = '';
    let adminOrders = [];
    const loadDashboardPage = async (append) => {
      const cursor = append ? adminOrderCursor : '';
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const [ordersResponse, productsResponse, couponsResponse, pincodesResponse] = await Promise.all([
        request(`/api/orders${query}`),
        request('/api/products?includeInactive=true'),
        request('/api/coupons?includeInactive=true'),
        request('/api/pincodes?includeInactive=true')
      ]);
      adminOrders = append ? [...adminOrders, ...ordersResponse.orders] : ordersResponse.orders;
      adminOrderCursor = ordersResponse.nextCursor || '';
      $('#load-more-orders').hidden = !adminOrderCursor;
      renderBackendDashboard(adminOrders, productsResponse.products, couponsResponse.coupons, pincodesResponse.pincodes, ordersResponse.summary, request, announce, loadDashboard);
    };
    $('#admin-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = $('#admin-login-id').value.trim();
      const password = $('#admin-login-password').value;
      const message = $('#admin-login-message');
      message.textContent = '';
      try {
        const result = await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        $('#admin-login-password').value = '';
        $('#admin-current-user').textContent = result.username;
        $('#admin-name-heading').textContent = `${result.username}.`;
        $('#settings-form').elements.username.value = result.username;
        $('#admin-login').hidden = true;
        $('#admin-app').hidden = false;
        await loadDashboard();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    $('#admin-logout').addEventListener('click', async () => {
      try {
        await request('/api/admin/logout', { method: 'POST', body: '{}' });
      } catch (error) {
        console.error('Admin logout request failed.', error);
      }
      showLogin();
    });
    $('#refresh-admin').addEventListener('click', () => loadDashboard().catch((error) => announce(error.message)));
    $('#load-more-orders').addEventListener('click', () => loadDashboardPage(true).catch((error) => announce(error.message)));
    $('#product-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const id = String(data.get('id') || '');
      const product = Object.fromEntries(['name', 'category', 'price', 'unit', 'description', 'image', 'alt'].map((key) => [key, data.get(key)]));
      product.price = Number(product.price);
      try {
        await request(id ? `/api/products/${encodeURIComponent(id)}` : '/api/products', {
          method: id ? 'PATCH' : 'POST',
          body: JSON.stringify(product)
        });
        form.reset();
        form.elements.id.value = '';
        resetEditor();
        await loadDashboard();
        announce(id ? 'Product updated.' : 'Product added.');
      } catch (error) { announce(error.message); }
    });
    $('#cancel-product-edit').addEventListener('click', () => {
      $('#product-form').reset();
      $('#product-form').elements.id.value = '';
      resetEditor();
    });
    $('#coupon-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        const { coupon } = await request('/api/coupons', {
          method: 'POST',
          body: JSON.stringify({ type: data.get('type'), value: Number(data.get('value')) })
        });
        await loadDashboard();
        announce(`Generated coupon ${coupon.code}.`);
      } catch (error) { announce(error.message); }
    });
    $('#pincode-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      try {
        const { pincode } = await request('/api/pincodes', {
          method: 'POST',
          body: JSON.stringify({ pin: String(data.get('pin')).trim(), label: String(data.get('label')).trim() })
        });
        form.reset();
        await loadDashboard();
        announce(`PIN code ${pincode.pin} added and activated.`);
      } catch (error) { announce(error.message); }
    });
    $('#settings-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      try {
        await request('/api/admin/credentials', {
          method: 'PATCH',
          body: JSON.stringify({
            username: form.elements.username.value.trim(),
            currentPassword: form.elements.currentPassword.value,
            password: form.elements.password.value
          })
        });
        form.reset();
        showLogin();
        announce('Credentials updated. Sign in again with the new credentials.');
      } catch (error) { announce(error.message); }
    });
    try {
      const session = await request('/api/admin/session');
      $('#admin-current-user').textContent = session.username;
      $('#admin-name-heading').textContent = `${session.username}.`;
      $('#settings-form').elements.username.value = session.username;
      $('#admin-login').hidden = true;
      $('#admin-app').hidden = false;
      await loadDashboard();
    } catch (error) {
      if (!error.message.includes('Sign in is required') && !error.message.includes('session has expired')) {
        $('#admin-login-message').textContent = error.message;
      }
    }

    function showLogin() {
      $('#admin-app').hidden = true;
      $('#admin-login').hidden = false;
      $('#admin-login-form').reset();
      $('#admin-login-message').textContent = '';
    }

    function resetEditor() {
      $('#save-product').innerHTML = 'Add product <span aria-hidden="true">+</span>';
      $('#cancel-product-edit').hidden = true;
    }
  }

  function renderBackendDashboard(orders, products, coupons, pincodes, summary, request, announce, reload) {
    const address = (customer) => [
      customer.addressLine1 || customer.address,
      customer.area,
      customer.landmark ? `Near ${customer.landmark}` : '',
      [customer.city, customer.state].filter(Boolean).join(', '),
      customer.pin ? `PIN ${customer.pin}` : '',
      customer.instructions ? `Notes: ${customer.instructions}` : ''
    ].filter(Boolean).join(', ');
    const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    $('#orders-empty').hidden = orders.length > 0;
    $('#orders-table').innerHTML = orders.map((order) => `
      <tr><td><strong>${escape(order.id)}</strong><br>${escape(order.customer.name)}<br>${escape(order.customer.phone)}${order.customer.email ? `<br>${escape(order.customer.email)}` : ''}<br>${escape(address(order.customer))}</td>
      <td>${escape(order.customer.deliveryDay || order.deliveryDate)}<br>${escape(order.customer.deliverySlot || order.deliverySlot)}${order.deliveryAgent ? `<br>Agent: ${escape(order.deliveryAgent)}` : ''}</td>
      <td>${order.items.map((item) => `${escape(item.name)} × ${item.quantity}`).join('<br>')}<br><strong>Total ₹${order.total}</strong></td>
      <td>${escape(order.paymentStatus)}<br>No live payment</td>
      <td><span class="order-state ${order.status === 'Declined' ? 'declined' : order.status === 'Awaiting admin review' || order.status === 'Awaiting payment initiation' ? '' : 'accepted'}">${escape(order.status)}</span>
      ${order.status === 'Awaiting admin review' ? `<div class="table-actions"><button data-order-action="${escape(order.id)}" data-status="Accepted">Accept</button><button class="danger" data-order-action="${escape(order.id)}" data-status="Declined">Decline</button></div>` : order.status === 'Awaiting payment initiation' ? 'Awaiting customer payment step' : order.status === 'Declined' ? 'Order declined' : `<label class="admin-field delivery-status-field">Delivery status<select data-delivery-status="${escape(order.id)}"><option ${order.status === 'Accepted' ? 'selected' : ''}>Accepted</option><option ${order.status === 'Preparing' ? 'selected' : ''}>Preparing</option><option ${order.status === 'Packed' ? 'selected' : ''}>Packed</option><option ${order.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option><option ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option></select></label><label class="admin-field delivery-status-field">Delivery agent<input data-delivery-agent="${escape(order.id)}" value="${escape(order.deliveryAgent || '')}" maxlength="80"></label><button class="admin-button delivery-save" data-save-delivery="${escape(order.id)}">Save delivery update</button>`}</td></tr>`).join('');
    $('#orders-table').querySelectorAll('[data-order-action]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await request(`/api/orders/${encodeURIComponent(button.dataset.orderAction)}`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) });
        await reload();
        announce(`Order ${button.dataset.status.toLowerCase()}.`);
      } catch (error) { announce(error.message); }
    }));
    $('#orders-table').querySelectorAll('[data-save-delivery]').forEach((button) => button.addEventListener('click', async () => {
      const id = button.dataset.saveDelivery;
      const status = $('#orders-table').querySelector(`[data-delivery-status="${CSS.escape(id)}"]`).value;
      const deliveryAgent = $('#orders-table').querySelector(`[data-delivery-agent="${CSS.escape(id)}"]`).value.trim();
      try {
        await request(`/api/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, deliveryAgent }) });
        await reload();
        announce('Delivery update saved.');
      } catch (error) { announce(error.message); }
    }));
    $('#products-table').innerHTML = products.map((product) => `
      <tr><td><strong>${escape(product.name)}</strong><br>${escape(product.description)}${product.active ? '' : '<br><span class="order-state declined">Removed</span>'}</td>
      <td>${escape(product.category)}</td><td>₹${product.price} / ${escape(product.unit)}</td>
      <td>${product.image ? `<img src="${escape(product.image)}" alt="${escape(product.alt || product.name)}">` : 'No image'}</td>
      <td><div class="table-actions"><button data-edit-product="${escape(product.id)}">Edit</button>${product.active ? `<button class="danger" data-remove-product="${escape(product.id)}">Remove</button>` : ''}</div></td></tr>`).join('');
    $('#products-table').querySelectorAll('[data-edit-product]').forEach((button) => button.addEventListener('click', () => {
      const product = products.find((item) => item.id === button.dataset.editProduct);
      if (!product) return;
      const form = $('#product-form');
      ['id', 'name', 'category', 'price', 'unit', 'description', 'image', 'alt'].forEach((key) => { form.elements[key].value = product[key] ?? ''; });
      $('#save-product').innerHTML = 'Save changes <span aria-hidden="true">→</span>';
      $('#cancel-product-edit').hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    $('#products-table').querySelectorAll('[data-remove-product]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await request(`/api/products/${encodeURIComponent(button.dataset.removeProduct)}`, { method: 'DELETE' });
        await reload();
        announce('Product removed.');
      } catch (error) { announce(error.message); }
    }));
    $('#coupons-table').innerHTML = coupons.map((coupon) => `
      <tr><td><strong>${escape(coupon.code)}</strong></td><td>${coupon.type === 'percent' ? `${coupon.value}% off` : `₹${coupon.value} off`}</td><td>${coupon.active ? 'Active' : 'Disabled'}</td>
      <td><div class="table-actions"><button data-toggle-coupon="${escape(coupon.code)}">${coupon.active ? 'Disable' : 'Enable'}</button><button class="danger" data-delete-coupon="${escape(coupon.code)}">Delete</button></div></td></tr>`).join('');
    $('#coupons-table').querySelectorAll('[data-toggle-coupon]').forEach((button) => button.addEventListener('click', async () => {
      const coupon = coupons.find((item) => item.code === button.dataset.toggleCoupon);
      try {
        await request(`/api/coupons/${encodeURIComponent(coupon.code)}`, { method: 'PATCH', body: JSON.stringify({ active: !coupon.active }) });
        await reload();
      } catch (error) { announce(error.message); }
    }));
    $('#coupons-table').querySelectorAll('[data-delete-coupon]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await request(`/api/coupons/${encodeURIComponent(button.dataset.deleteCoupon)}`, { method: 'DELETE' });
        await reload();
        announce('Coupon disabled.');
      } catch (error) { announce(error.message); }
    }));
    $('#pincodes-empty').hidden = pincodes.length > 0;
    $('#pincodes-table').innerHTML = pincodes.map((item) => `
      <tr><td><strong>${escape(item.pin)}</strong></td><td>${escape(item.label || '—')}</td><td>${item.active ? 'Active' : 'Inactive'}</td>
      <td><div class="table-actions"><button data-toggle-pincode="${escape(item.pin)}">${item.active ? 'Deactivate' : 'Activate'}</button><button class="danger" data-delete-pincode="${escape(item.pin)}">Remove</button></div></td></tr>`).join('');
    $('#pincodes-table').querySelectorAll('[data-toggle-pincode]').forEach((button) => button.addEventListener('click', async () => {
      const item = pincodes.find((entry) => entry.pin === button.dataset.togglePincode);
      try {
        await request(`/api/pincodes/${encodeURIComponent(item.pin)}`, { method: 'PATCH', body: JSON.stringify({ active: !item.active }) });
        await reload();
        announce(`PIN code ${item.pin} ${item.active ? 'deactivated' : 'activated'}.`);
      } catch (error) { announce(error.message); }
    }));
    $('#pincodes-table').querySelectorAll('[data-delete-pincode]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await request(`/api/pincodes/${encodeURIComponent(button.dataset.deletePincode)}`, { method: 'DELETE' });
        await reload();
        announce('PIN code removed.');
      } catch (error) { announce(error.message); }
    }));
    $('#metric-pending').textContent = String(summary.pending);
    $('#metric-products').textContent = String(products.filter((product) => product.active).length);
    $('#metric-coupons').textContent = String(coupons.filter((coupon) => coupon.active).length);
    $('#metric-revenue').textContent = `₹${summary.demoOrderValue}`;

  }
})();
