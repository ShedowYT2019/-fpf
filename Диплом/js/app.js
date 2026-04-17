// ===== STATE =====
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('apexCart') || '[]');
let wishlist = JSON.parse(localStorage.getItem('apexWish') || '[]');
let currentCategory = 'all';
let currentSort = 'default';
let currentFilter = 'all';
let searchQuery = '';
let promoApplied = false;
let adminLoggedIn = false;

const ADMIN_PASS = 'admin123';
const PROMO_CODES = { 'SPORT10': 10, 'SUMMER20': 20, 'FIRST15': 15 };

// ===== UTILS =====
const fmt = p => p.toLocaleString('uk-UA') + ' ₴';
const saveCart = () => localStorage.setItem('apexCart', JSON.stringify(cart));
const saveWish = () => localStorage.setItem('apexWish', JSON.stringify(wishlist));

function toast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : type === 'warn' ? ' warn' : '');
  t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'warn' ? '⚠' : '✕'}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2800);
  setTimeout(() => t.remove(), 3300);
}

function stockBadge(stock) {
  if (stock === 0) return `<span class="stock-badge out">Немає в наявності</span>`;
  if (stock <= 5) return `<span class="stock-badge low">Залишилось: ${stock}</span>`;
  return `<span class="stock-badge ok">В наявності: ${stock}</span>`;
}

function renderStars(r) {
  const f = Math.floor(r), h = r % 1 >= 0.5;
  return '★'.repeat(f) + (h ? '½' : '') + '☆'.repeat(5 - f - (h ? 1 : 0));
}

// ===== HEADER =====
function initHeader() {
  window.addEventListener('scroll', () => {
    document.getElementById('header').classList.toggle('scrolled', window.scrollY > 20);
  });
  document.getElementById('burgerBtn')?.addEventListener('click', () => {
    document.getElementById('mobileNav').classList.toggle('active');
  });
  document.querySelectorAll('#mobileNav a').forEach(a => {
    a.addEventListener('click', () => document.getElementById('mobileNav').classList.remove('active'));
  });
}

// ===== SEARCH =====
function initSearch() {
  const inp = document.getElementById('searchInput');
  const sugg = document.getElementById('searchSuggestions');
  if (!inp) return;
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    searchQuery = q;
    if (!q) { sugg.classList.remove('active'); return; }
    const matches = allProducts.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)).slice(0, 5);
    if (!matches.length) { sugg.classList.remove('active'); return; }
    sugg.innerHTML = matches.map(p => `
      <div class="search-suggestion-item" onclick="openProduct(${p.id}); document.getElementById('searchInput').value=''; document.getElementById('searchSuggestions').classList.remove('active');">
        <span style="font-size:20px">${p.emoji}</span>
        <div><div>${p.name}</div><span class="cat">${p.brand} · ${fmt(p.price)}</span></div>
      </div>`).join('');
    sugg.classList.add('active');
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) sugg.classList.remove('active'); });
}

// ===== LOAD & RENDER PRODUCTS =====
async function loadProducts() {
  allProducts = await dbGetAll('products');
  renderCategories();
  renderProducts();
  renderHeroRotator();
}

function getCategories() {
  const cats = [{ id: 'all', name: 'Усі товари', icon: '🏆' }];
  const map = { shoes: { name: 'Взуття', icon: '👟' }, clothing: { name: 'Одяг', icon: '👕' }, equipment: { name: 'Обладнання', icon: '🏋️' }, accessories: { name: 'Аксесуари', icon: '⌚' } };
  for (const [id, info] of Object.entries(map)) {
    const count = allProducts.filter(p => p.category === id).length;
    if (count) cats.push({ id, ...info, count });
  }
  cats[0].count = allProducts.length;
  return cats;
}

function renderCategories() {
  const grids = document.querySelectorAll('.categories-grid-auto');
  grids.forEach(el => {
    el.innerHTML = getCategories().map(c => `
      <div class="cat-card fade-in ${currentCategory === c.id ? 'active' : ''}" onclick="setCategory('${c.id}')">
        <span class="cat-icon">${c.icon}</span>
        <span class="cat-name">${c.name}</span>
        <span class="cat-count">${c.count} товарів</span>
      </div>`).join('');
  });
  observeFadeIn();
}

function setCategory(id) {
  currentCategory = id;
  renderCategories();
  renderProducts();
  const pg = document.getElementById('page-catalog');
  if (pg && !pg.classList.contains('active')) navigate('catalog');
  else document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getFiltered() {
  let list = [...allProducts];
  if (currentCategory !== 'all') list = list.filter(p => p.category === currentCategory);
  if (currentFilter === 'sale') list = list.filter(p => p.badge === 'sale');
  else if (currentFilter === 'new') list = list.filter(p => p.badge === 'new');
  else if (currentFilter === 'hit') list = list.filter(p => p.badge === 'hit');
  else if (currentFilter === 'available') list = list.filter(p => p.stock > 0);
  if (searchQuery) list = list.filter(p => p.name.toLowerCase().includes(searchQuery) || p.brand.toLowerCase().includes(searchQuery));
  switch (currentSort) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'rating': list.sort((a, b) => b.rating - a.rating); break;
    case 'popular': list.sort((a, b) => b.reviews - a.reviews); break;
    case 'stock': list.sort((a, b) => b.stock - a.stock); break;
  }
  return list;
}

function renderProducts() {
  const grids = [
    { grid: document.getElementById('productsGrid'), count: document.getElementById('productsCount') },
    { grid: document.getElementById('productsGrid2'), count: document.getElementById('productsCount2') },
  ];
  const list = getFiltered();
  grids.forEach(({ grid, count }) => {
    if (!grid) return;
    if (count) count.textContent = `${list.length} товарів`;
    if (!list.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--gray)"><div style="font-size:48px;margin-bottom:12px">🔍</div><p>Товари не знайдено</p></div>`;
      return;
    }
    grid.innerHTML = list.map(p => {
      const inWish = wishlist.includes(p.id);
      const outOfStock = p.stock === 0;
      return `
      <div class="product-card fade-in ${outOfStock ? 'out-of-stock' : ''}" onclick="openProduct(${p.id})">
        <div class="product-img">
          ${p.badge ? `<span class="product-badge badge-${p.badge}">${p.badge === 'new' ? 'NEW' : p.badge === 'sale' ? 'SALE' : 'ХІТ'}</span>` : ''}
          <button class="wishlist-btn ${inWish ? 'active' : ''}" onclick="toggleWish(event,${p.id})">${inWish ? '❤️' : '🤍'}</button>
          <span style="font-size:80px;${outOfStock ? 'opacity:.4;filter:grayscale(1)' : ''}">${p.emoji}</span>
          ${!outOfStock ? `<div class="product-quick-add"><button class="quick-add-btn" onclick="quickAdd(event,${p.id})">+ До кошика</button></div>` : `<div class="product-quick-add"><button class="quick-add-btn" style="background:#444;color:#888;cursor:not-allowed">Немає в наявності</button></div>`}
        </div>
        <div class="product-info">
          <div class="product-brand">${p.brand}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-rating">
            <span class="stars">${renderStars(p.rating)}</span>
            <span class="rating-count">${p.rating} (${p.reviews})</span>
          </div>
          <div style="margin-bottom:8px">${stockBadge(p.stock)}</div>
          <div class="product-price-row">
            <span class="product-price">${fmt(p.price)}</span>
            ${p.oldPrice ? `<span class="product-price-old">${fmt(p.oldPrice)}</span><span class="product-price-discount">-${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    observeFadeIn();
  });
}

// ===== PRODUCT MODAL =====
async function openProduct(id) {
  const p = await dbGet('products', id);
  if (!p) return;
  const modal = document.getElementById('productModal');
  const content = document.getElementById('modalContent');
  const outOfStock = p.stock === 0;
  content.innerHTML = `
    <div class="modal-body">
      <div class="modal-img-side" style="${outOfStock ? 'filter:grayscale(.6)' : ''}">${p.emoji}</div>
      <div class="modal-info-side">
        <div class="modal-brand">${p.brand}</div>
        <div class="modal-name">${p.name}</div>
        <div class="modal-rating">
          <span class="modal-stars">${renderStars(p.rating)}</span>
          <span class="modal-rating-text">${p.rating} · ${p.reviews} відгуків</span>
        </div>
        <div class="modal-price-row">
          <span class="modal-price">${fmt(p.price)}</span>
          ${p.oldPrice ? `<span class="modal-price-old">${fmt(p.oldPrice)}</span>` : ''}
        </div>
        <p class="modal-desc">${p.desc}</p>
        <div style="margin-bottom:16px">${stockBadge(p.stock)}</div>
        <div class="modal-options-label">Розмір</div>
        <div class="size-options" id="sizeOptions">
          ${(p.sizes || '').split(',').map((s, i) => `<button class="size-btn ${i === 0 ? 'active' : ''}" onclick="selectSize(this)">${s.trim()}</button>`).join('')}
        </div>
        ${!outOfStock
          ? `<button class="modal-add-btn" onclick="addToCartFromModal(${p.id})">🛒 Додати до кошика</button>`
          : `<button class="modal-add-btn" style="background:#333;color:#666;cursor:not-allowed">Немає в наявності</button>`
        }
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function selectSize(btn) {
  btn.closest('.size-options').querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function addToCartFromModal(id) {
  const activeSize = document.querySelector('#sizeOptions .size-btn.active');
  const size = activeSize ? activeSize.textContent.trim() : '';
  await addToCart(id, size);
  closeModal();
  openCart();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ===== CART =====
async function addToCart(id, size = '') {
  const p = await dbGet('products', id);
  if (!p || p.stock === 0) { toast('Товар відсутній в наявності', 'error'); return; }
  const cartQty = cart.filter(i => i.id === id).reduce((s, i) => s + i.qty, 0);
  if (cartQty >= p.stock) { toast(`Максимум ${p.stock} шт. в наявності`, 'warn'); return; }
  const existing = cart.find(i => i.id === id && i.size === size);
  if (existing) existing.qty++;
  else cart.push({ id, size, qty: 1 });
  saveCart();
  updateCartBadge();
  renderCart();
  toast(`${p.name} додано до кошика`);
}

function quickAdd(e, id) {
  e.stopPropagation();
  dbGet('products', id).then(p => {
    if (!p) return;
    const sizes = (p.sizes || '').split(',');
    addToCart(id, sizes[0]?.trim() || '');
  });
}

function removeFromCart(id, size) {
  cart = cart.filter(i => !(i.id === id && i.size === size));
  saveCart(); updateCartBadge(); renderCart();
}

function changeQty(id, size, delta) {
  const item = cart.find(i => i.id === id && i.size === size);
  if (!item) return;
  dbGet('products', id).then(p => {
    if (!p) return;
    if (delta > 0 && item.qty >= p.stock) { toast(`Максимум ${p.stock} шт.`, 'warn'); return; }
    item.qty += delta;
    if (item.qty <= 0) removeFromCart(id, size);
    else { saveCart(); renderCart(); }
  });
}

function updateCartBadge() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const b = document.getElementById('cartBadge');
  if (b) { b.textContent = total; b.style.display = total ? 'flex' : 'none'; }
}

async function renderCart() {
  const items = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  if (!items) return;
  if (!cart.length) {
    items.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>Кошик порожній</p></div>`;
    if (footer) footer.style.display = 'none';
    return;
  }
  if (footer) footer.style.display = 'block';
  const rows = await Promise.all(cart.map(async item => {
    const p = await dbGet('products', item.id);
    if (!p) return '';
    return `
    <div class="cart-item">
      <div class="cart-item-img">${p.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${p.name}</div>
        <div class="cart-item-meta">${p.brand} · Розмір: ${item.size}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty(${item.id},'${item.size}',-1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id},'${item.size}',1)">+</button>
          <button class="cart-item-remove" onclick="removeFromCart(${item.id},'${item.size}')">✕</button>
        </div>
        <div style="font-size:11px;color:var(--gray);margin-top:4px">В наявності: ${p.stock} шт.</div>
      </div>
      <div class="cart-item-price">${fmt(p.price * item.qty)}</div>
    </div>`;
  }));
  items.innerHTML = rows.join('');

  let subtotal = 0;
  for (const item of cart) {
    const p = await dbGet('products', item.id);
    if (p) subtotal += p.price * item.qty;
  }
  const discount = promoApplied ? Math.round(subtotal * promoApplied / 100) : 0;
  const shipping = subtotal > 1500 ? 0 : 149;
  const total = subtotal - discount + shipping;
  document.getElementById('cartSubtotal').textContent = fmt(subtotal);
  document.getElementById('cartShipping').textContent = shipping === 0 ? 'Безкоштовно' : fmt(shipping);
  document.getElementById('cartTotal').textContent = fmt(total);
  const dr = document.getElementById('cartDiscountRow');
  dr.style.display = promoApplied ? 'flex' : 'none';
  document.getElementById('cartDiscount').textContent = '−' + fmt(discount);
}

function applyPromo() {
  const inp = document.getElementById('promoInput');
  const code = inp.value.trim().toUpperCase();
  if (PROMO_CODES[code]) {
    promoApplied = PROMO_CODES[code];
    toast(`Промокод застосовано! Знижка ${promoApplied}% 🎉`);
    renderCart(); inp.value = '';
  } else {
    toast('Невірний промокод', 'error');
  }
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('active');
  document.getElementById('cartOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('active');
  document.getElementById('cartOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

async function checkout() {
  if (!cart.length) { toast('Кошик порожній!', 'error'); return; }
  // Перевірка залишків та зменшення stock
  for (const item of cart) {
    const p = await dbGet('products', item.id);
    if (!p || p.stock < item.qty) {
      toast(`Недостатньо ${p ? p.name : 'товару'} на складі`, 'error');
      await loadProducts(); return;
    }
  }
  // Зберегти замовлення
  let total = 0;
  const orderItems = [];
  for (const item of cart) {
    const p = await dbGet('products', item.id);
    total += p.price * item.qty;
    orderItems.push({ id: p.id, name: p.name, brand: p.brand, emoji: p.emoji, price: p.price, size: item.size, qty: item.qty });
    // Зменшити stock
    p.stock -= item.qty;
    await dbPut('products', p);
  }
  const discount = promoApplied ? Math.round(total * promoApplied / 100) : 0;
  await dbAdd('orders', {
    date: new Date().toISOString(),
    items: orderItems,
    total: total - discount,
    promo: promoApplied || null,
    status: 'new'
  });
  cart = [];
  promoApplied = false;
  saveCart();
  updateCartBadge();
  await renderCart();
  closeCart();
  await loadProducts();
  toast('Замовлення оформлено! Дякуємо! 🎉');
}

// ===== WISHLIST =====
function toggleWish(e, id) {
  e.stopPropagation();
  const idx = wishlist.indexOf(id);
  if (idx === -1) { wishlist.push(id); toast('Додано до обраного ❤️'); }
  else { wishlist.splice(idx, 1); toast('Видалено з обраного'); }
  saveWish(); updateWishBadge(); renderProducts();
  const wg = document.getElementById('wishlistGrid');
  if (wg) renderWishlistPage();
}

function updateWishBadge() {
  const b = document.getElementById('wishBadge');
  if (b) { b.textContent = wishlist.length; b.style.display = wishlist.length ? 'flex' : 'none'; }
}

async function renderWishlistPage() {
  const grid = document.getElementById('wishlistGrid');
  if (!grid) return;
  if (!wishlist.length) {
    grid.innerHTML = `<div style="text-align:center;padding:60px;color:var(--gray);grid-column:1/-1"><div style="font-size:64px;margin-bottom:16px">❤️</div><p>Список обраного порожній</p></div>`;
    return;
  }
  const list = await Promise.all(wishlist.map(id => dbGet('products', id)));
  const valid = list.filter(Boolean);
  grid.innerHTML = valid.map(p => {
    const outOfStock = p.stock === 0;
    return `
    <div class="product-card fade-in" onclick="openProduct(${p.id})">
      <div class="product-img">
        <button class="wishlist-btn active" onclick="toggleWish(event,${p.id})">❤️</button>
        <span style="font-size:80px;${outOfStock ? 'opacity:.4;filter:grayscale(1)' : ''}">${p.emoji}</span>
        ${!outOfStock ? `<div class="product-quick-add"><button class="quick-add-btn" onclick="quickAdd(event,${p.id})">+ До кошика</button></div>` : ''}
      </div>
      <div class="product-info">
        <div class="product-brand">${p.brand}</div>
        <div class="product-name">${p.name}</div>
        <div style="margin:6px 0">${stockBadge(p.stock)}</div>
        <div class="product-price-row">
          <span class="product-price">${fmt(p.price)}</span>
          ${p.oldPrice ? `<span class="product-price-old">${fmt(p.oldPrice)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  observeFadeIn();
}

// ===== HERO ROTATOR =====
function renderHeroRotator() {
  const featured = allProducts.filter(p => p.badge === 'hit' || p.badge === 'new');
  if (!featured.length) return;
  let idx = 0;
  const update = () => {
    const p = featured[idx % featured.length];
    const el = document.getElementById('heroProductEmoji');
    const nm = document.getElementById('heroProductName');
    const pr = document.getElementById('heroProductPrice');
    if (el) { el.style.opacity = '0'; setTimeout(() => { el.textContent = p.emoji; el.style.opacity = '1'; }, 300); }
    if (nm) nm.textContent = p.name;
    if (pr) pr.textContent = fmt(p.price);
    idx++;
  };
  update();
  clearInterval(window._heroInterval);
  window._heroInterval = setInterval(update, 3000);
}

// ===== ADMIN =====
function openAdmin() {
  if (!adminLoggedIn) {
    document.getElementById('adminLoginOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  } else {
    navigate('admin');
  }
}

function adminLogin() {
  const pass = document.getElementById('adminPassInput').value;
  if (pass === ADMIN_PASS) {
    adminLoggedIn = true;
    document.getElementById('adminLoginOverlay').classList.remove('active');
    document.body.style.overflow = '';
    navigate('admin');
    renderAdminProducts();
    renderAdminOrders();
    toast('Вхід виконано ✓');
  } else {
    toast('Невірний пароль', 'error');
  }
}

function closeAdminLogin() {
  document.getElementById('adminLoginOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

async function renderAdminProducts() {
  const tbody = document.getElementById('adminProductsTable');
  if (!tbody) return;
  const products = await dbGetAll('products');
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><span style="font-size:28px">${p.emoji}</span></td>
      <td><strong>${p.name}</strong><br><span style="color:var(--gray);font-size:12px">${p.brand}</span></td>
      <td><span class="cat-badge cat-${p.category}">${p.category}</span></td>
      <td>${fmt(p.price)}${p.oldPrice ? `<br><span style="color:var(--gray);font-size:11px;text-decoration:line-through">${fmt(p.oldPrice)}</span>` : ''}</td>
      <td>
        <div class="stock-edit-row">
          <button class="stock-btn" onclick="changeStock(${p.id}, -1)">−</button>
          <span class="stock-num ${p.stock === 0 ? 'zero' : p.stock <= 5 ? 'low' : ''}" id="stock-${p.id}">${p.stock}</span>
          <button class="stock-btn" onclick="changeStock(${p.id}, 1)">+</button>
          <input type="number" class="stock-input" id="stockInput-${p.id}" placeholder="Встановити" min="0" onkeydown="if(event.key==='Enter')setStock(${p.id})">
          <button class="stock-set-btn" onclick="setStock(${p.id})">OK</button>
        </div>
      </td>
      <td>${p.badge ? `<span class="product-badge badge-${p.badge}" style="position:static;display:inline-block">${p.badge}</span>` : '—'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="admin-btn edit" onclick="openEditProduct(${p.id})">✏️</button>
          <button class="admin-btn del" onclick="deleteProduct(${p.id})">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

async function changeStock(id, delta) {
  const p = await dbGet('products', id);
  if (!p) return;
  p.stock = Math.max(0, p.stock + delta);
  await dbPut('products', p);
  const el = document.getElementById(`stock-${id}`);
  if (el) {
    el.textContent = p.stock;
    el.className = 'stock-num' + (p.stock === 0 ? ' zero' : p.stock <= 5 ? ' low' : '');
  }
  allProducts = await dbGetAll('products');
  renderProducts();
}

async function setStock(id) {
  const inp = document.getElementById(`stockInput-${id}`);
  const val = parseInt(inp.value);
  if (isNaN(val) || val < 0) { toast('Невірне значення', 'error'); return; }
  const p = await dbGet('products', id);
  if (!p) return;
  p.stock = val;
  await dbPut('products', p);
  inp.value = '';
  toast(`Залишок оновлено: ${val} шт.`);
  await renderAdminProducts();
  allProducts = await dbGetAll('products');
  renderProducts();
}

async function deleteProduct(id) {
  if (!confirm('Видалити товар?')) return;
  await dbDelete('products', id);
  toast('Товар видалено');
  await renderAdminProducts();
  allProducts = await dbGetAll('products');
  renderCategories();
  renderProducts();
}

// Add/Edit product form
let editingProductId = null;

function openAddProduct() {
  editingProductId = null;
  document.getElementById('productFormTitle').textContent = 'Додати товар';
  document.getElementById('productForm').reset();
  document.getElementById('productFormOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

async function openEditProduct(id) {
  const p = await dbGet('products', id);
  if (!p) return;
  editingProductId = id;
  document.getElementById('productFormTitle').textContent = 'Редагувати товар';
  const f = document.getElementById('productForm');
  f.querySelector('[name=name]').value = p.name;
  f.querySelector('[name=brand]').value = p.brand;
  f.querySelector('[name=category]').value = p.category;
  f.querySelector('[name=price]').value = p.price;
  f.querySelector('[name=oldPrice]').value = p.oldPrice || '';
  f.querySelector('[name=emoji]').value = p.emoji;
  f.querySelector('[name=badge]').value = p.badge || '';
  f.querySelector('[name=stock]').value = p.stock;
  f.querySelector('[name=desc]').value = p.desc;
  f.querySelector('[name=sizes]').value = p.sizes || '';
  f.querySelector('[name=rating]').value = p.rating;
  document.getElementById('productFormOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeProductForm() {
  document.getElementById('productFormOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

async function saveProduct(e) {
  e.preventDefault();
  const f = document.getElementById('productForm');
  const data = {
    name: f.querySelector('[name=name]').value.trim(),
    brand: f.querySelector('[name=brand]').value.trim(),
    category: f.querySelector('[name=category]').value,
    price: parseFloat(f.querySelector('[name=price]').value),
    oldPrice: parseFloat(f.querySelector('[name=oldPrice]').value) || null,
    emoji: f.querySelector('[name=emoji]').value.trim() || '📦',
    badge: f.querySelector('[name=badge]').value || null,
    stock: parseInt(f.querySelector('[name=stock]').value) || 0,
    desc: f.querySelector('[name=desc]').value.trim(),
    sizes: f.querySelector('[name=sizes]').value.trim(),
    rating: parseFloat(f.querySelector('[name=rating]').value) || 4.5,
    reviews: editingProductId ? (await dbGet('products', editingProductId)).reviews : 0,
  };
  if (editingProductId) {
    data.id = editingProductId;
    await dbPut('products', data);
    toast('Товар оновлено ✓');
  } else {
    await dbAdd('products', data);
    toast('Товар додано ✓');
  }
  closeProductForm();
  await renderAdminProducts();
  allProducts = await dbGetAll('products');
  renderCategories();
  renderProducts();
}

// ===== ORDERS =====
async function renderAdminOrders() {
  const tbody = document.getElementById('adminOrdersTable');
  if (!tbody) return;
  const orders = await dbGetAll('orders');
  orders.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:32px">Замовлень ще немає</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-size:12px;color:var(--gray)">#${o.id}<br>${new Date(o.date).toLocaleString('uk-UA')}</td>
      <td>${o.items.map(i => `<span style="font-size:18px">${i.emoji}</span>`).join(' ')}<br>
        <span style="font-size:11px;color:var(--gray)">${o.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</span></td>
      <td style="font-family:var(--font-display);font-size:20px;color:var(--primary)">${fmt(o.total)}</td>
      <td>${o.promo ? `<span class="product-badge badge-sale" style="position:static;display:inline-block">-${o.promo}%</span>` : '—'}</td>
      <td>
        <select class="order-status-select" onchange="updateOrderStatus(${o.id}, this.value)">
          <option value="new" ${o.status === 'new' ? 'selected' : ''}>🆕 Нове</option>
          <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>⚙️ В обробці</option>
          <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>🚚 Відправлено</option>
          <option value="done" ${o.status === 'done' ? 'selected' : ''}>✅ Виконано</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>❌ Скасовано</option>
        </select>
      </td>
    </tr>`).join('');
}

async function updateOrderStatus(id, status) {
  const o = await dbGet('orders', id);
  if (!o) return;
  o.status = status;
  await dbPut('orders', o);
  toast('Статус оновлено');
}

// ===== ADMIN STATS =====
async function renderAdminStats() {
  const products = await dbGetAll('products');
  const orders = await dbGetAll('orders');
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const outStock = products.filter(p => p.stock === 0).length;
  document.getElementById('statProducts').textContent = products.length;
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statRevenue').textContent = fmt(totalRevenue);
  document.getElementById('statLow').textContent = lowStock;
  document.getElementById('statOut').textContent = outStock;
}

// Admin tab switcher
function adminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('admin-' + tab).classList.add('active');
  if (tab === 'orders') renderAdminOrders();
  if (tab === 'products') renderAdminProducts();
  if (tab === 'stats') renderAdminStats();
}

// ===== NAVIGATION =====
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a, #mobileNav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
    if (page === 'wishlist') renderWishlistPage();
    if (page === 'catalog') renderProducts();
    if (page === 'admin') { renderAdminProducts(); renderAdminStats(); }
  } else {
    document.getElementById('page-home').classList.add('active');
  }
}

// ===== FILTERS =====
function initFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.filters-row').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderProducts();
    });
  });
  document.querySelectorAll('.sort-select').forEach(el => {
    el.addEventListener('change', () => { currentSort = el.value; renderProducts(); });
  });
}

// ===== SCROLL ANIMATIONS =====
function observeFadeIn() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 50);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => obs.observe(el));
}

// ===== LOADING BAR =====
function initLoadingBar() {
  const bar = document.getElementById('loadingBar');
  if (!bar) return;
  let w = 0;
  const t = setInterval(() => { w += Math.random() * 25; if (w >= 90) clearInterval(t); bar.style.width = Math.min(w, 90) + '%'; }, 80);
  window.addEventListener('load', () => { bar.style.width = '100%'; setTimeout(() => bar.style.opacity = '0', 300); });
}

// ===== NEWSLETTER =====
function initNewsletter() {
  document.getElementById('newsletterForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const email = e.target.querySelector('input').value;
    if (!email) return;
    toast(`Підписку оформлено для ${email} 📧`);
    e.target.querySelector('input').value = '';
  });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  initLoadingBar();
  await initDB();
  await seedIfEmpty();
  await loadProducts();
  initHeader();
  initSearch();
  initFilters();
  initNewsletter();
  updateCartBadge();
  updateWishBadge();
  renderCart();
  observeFadeIn();

  // Listeners
  document.getElementById('cartBtn')?.addEventListener('click', openCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  document.getElementById('cartCloseBtn')?.addEventListener('click', closeCart);
  document.getElementById('modalOverlay')?.addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeModal(); });
  document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
  document.getElementById('checkoutBtn')?.addEventListener('click', checkout);
  document.getElementById('promoBtn')?.addEventListener('click', applyPromo);
  document.getElementById('wishBtn')?.addEventListener('click', () => navigate('wishlist'));
  document.getElementById('adminBtn')?.addEventListener('click', openAdmin);
  document.getElementById('adminLoginBtn')?.addEventListener('click', adminLogin);
  document.getElementById('adminLoginClose')?.addEventListener('click', closeAdminLogin);
  document.getElementById('adminPassInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
  document.getElementById('addProductBtn')?.addEventListener('click', openAddProduct);
  document.getElementById('productFormOverlay')?.addEventListener('click', e => { if (e.target.id === 'productFormOverlay') closeProductForm(); });
  document.getElementById('productFormClose')?.addEventListener('click', closeProductForm);
  document.getElementById('productForm')?.addEventListener('submit', saveProduct);
  document.querySelectorAll('.admin-tab').forEach(t => t.addEventListener('click', () => adminTab(t.dataset.tab)));

  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); });
  });
  document.querySelectorAll('[data-cat]').forEach(el => {
    el.addEventListener('click', () => { setCategory(el.dataset.cat); navigate('catalog'); });
  });
  document.getElementById('heroCatalogBtn')?.addEventListener('click', () => navigate('catalog'));
  document.getElementById('heroProductAddBtn')?.addEventListener('click', async () => {
    if (allProducts.length) { await addToCart(allProducts.find(p => p.badge === 'hit')?.id || allProducts[0].id, ''); openCart(); }
  });
});
