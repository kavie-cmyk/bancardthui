/* Bán Card Thui — storefront công khai.
 * Đọc DUY NHẤT view `storefront_listings` bằng anon key (không đăng nhập).
 * Đặt hàng: POST vào bảng `store_orders` (anon chỉ INSERT được đơn mới,
 * không đọc được đơn của ai — kể cả đơn mình vừa gửi). Đơn web KHÔNG trừ
 * kho; shop xác nhận trong app kho rồi mới tạo đơn bán thật.
 * Xem supabase/storefront.sql + supabase/store-orders.sql.
 */
(function () {
  'use strict';

  var stateEl = document.getElementById('state');
  var gridEl = document.getElementById('grid');
  var rows = [];
  var rowById = {};
  var langFilter = 'all';

  /* ---------------- giỏ hàng (lưu localStorage) ---------------- */
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem('bct_cart') || '{}') || {}; } catch (e) { cart = {}; }
  function saveCart() { try { localStorage.setItem('bct_cart', JSON.stringify(cart)); } catch (e) {} }
  function cartCount() { return Object.keys(cart).reduce(function (s, k) { return s + (cart[k] || 0); }, 0); }
  function cartTotal() {
    return Object.keys(cart).reduce(function (s, k) {
      var r = rowById[k];
      return s + (r ? r.price * cart[k] : 0);
    }, 0);
  }
  function pruneCart() {
    Object.keys(cart).forEach(function (k) {
      var r = rowById[k];
      if (!r) delete cart[k];
      else if (cart[k] > r.qty) cart[k] = r.qty;
      if (cart[k] <= 0) delete cart[k];
    });
    saveCart();
  }
  function setQty(listingId, qty) {
    var r = rowById[listingId];
    if (!r) return;
    qty = Math.max(0, Math.min(qty, r.qty));
    if (qty === 0) delete cart[listingId]; else cart[listingId] = qty;
    saveCart();
    renderGrid();
    renderCartUI();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtVND(n) { return Number(n || 0).toLocaleString('vi-VN') + '₫'; }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  /* ----- ảnh: ảnh thật đã upload → ảnh chính thức TCGdex → placeholder ----- */
  function parseNum(num) {
    var m = String(num == null ? '' : num).match(/\d+/);
    if (!m) return null;
    var n = parseInt(m[0], 10);
    return n > 0 ? n : null;
  }
  function tcgdexURLs(row) {
    var num = String(row.number || '').split('/')[0].trim();
    if (!num || !row.set_id) return [];
    var serie = null, lang = 'en';
    var db = window.BCT_SETS || null;
    if ((row.language || 'en') === 'jp') {
      serie = db && db.jaSerie ? db.jaSerie(row.set_id) : null;
      if (serie) lang = 'ja';
    }
    if (!serie && db && db.byId) {
      var s = db.byId(row.set_id);
      if (s && s.serie) { serie = s.serie; lang = 'en'; }
    }
    if (!serie) return [];
    var base = 'https://assets.tcgdex.net/' + lang + '/' + serie + '/' + row.set_id + '/';
    var urls = [base + encodeURIComponent(num) + '/low.png'];
    var n = parseNum(num);
    if (n != null && String(n) !== num) urls.push(base + n + '/low.png');
    return urls;
  }
  function imgTag(row) {
    var urls = [];
    if (row.photo_url) urls.push(row.photo_url);
    urls = urls.concat(tcgdexURLs(row));
    if (!urls.length) return '<div class="ph">Chưa có ảnh</div>';
    return '<img loading="lazy" alt="' + esc(row.name) + '" src="' + esc(urls[0]) + '"' +
      ' data-fb="' + esc(urls.slice(1).join('|')) + '" onerror="sfImgErr(this)">';
  }
  window.sfImgErr = function (img) {
    var fb = (img.getAttribute('data-fb') || '').split('|').filter(Boolean);
    if (fb.length) {
      img.setAttribute('data-fb', fb.slice(1).join('|'));
      img.src = fb[0];
    } else {
      img.outerHTML = '<div class="ph">Chưa có ảnh</div>';
    }
  };

  /* ----- nhãn hiển thị cho khách ----- */
  var COND_GLOSS = { 'New Mint': 'Mới tinh', 'A': 'Đẹp', 'B': 'Khá', 'C': 'Trung bình', 'D': 'Cũ' };
  var LANG_LABEL = { en: 'Bản Anh', jp: 'Bản Nhật', other: 'Bản khác' };

  function cartControlHTML(r) {
    var inCart = cart[r.listing_id] || 0;
    if (!inCart) {
      return '<button type="button" class="buy-btn" data-add="' + r.listing_id + '">Thêm vào giỏ</button>';
    }
    return '<div class="stepper" role="group" aria-label="Số lượng trong giỏ">' +
      '<button type="button" data-dec="' + r.listing_id + '" aria-label="Bớt 1">−</button>' +
      '<span>' + inCart + ' trong giỏ</span>' +
      '<button type="button" data-inc="' + r.listing_id + '"' + (inCart >= r.qty ? ' disabled' : '') + ' aria-label="Thêm 1">+</button></div>';
  }

  function tileHTML(r) {
    var cond = r.lot_condition || r.card_condition || '';
    var badges = '';
    if (r.rarity) badges += '<span class="badge gold">' + esc(r.rarity) + '</span>';
    if (r.language && LANG_LABEL[r.language]) badges += '<span class="badge">' + LANG_LABEL[r.language] + '</span>';
    if (r.variant && r.variant !== 'Normal') badges += '<span class="badge">' + esc(r.variant) + '</span>';
    if (r.holo_pattern) badges += '<span class="badge">' + esc(r.holo_pattern) + '</span>';
    if (cond) badges += '<span class="badge">' + esc(cond) + (COND_GLOSS[cond] ? ' · ' + COND_GLOSS[cond] : '') + '</span>';
    if (r.graded_org) badges += '<span class="badge graded">' + esc(r.graded_org) + (r.graded_score ? ' ' + esc(r.graded_score) : '') + '</span>';

    return '<article class="tile">' +
      '<div class="tile-img">' + imgTag(r) + '</div>' +
      '<div class="tile-body">' +
        '<div class="tile-name">' + esc(r.name) + '</div>' +
        '<div class="tile-set">' + esc(r.set_name || '') + (r.number ? ' · #' + esc(r.number) : '') + '</div>' +
        (badges ? '<div class="badges">' + badges + '</div>' : '') +
        '<div class="tile-meta"><span class="tile-price">' + fmtVND(r.price) + '</span>' +
        '<span class="tile-qty">Còn ' + (Number(r.qty) || 0) + ' lá</span></div>' +
        cartControlHTML(r) +
      '</div></article>';
  }

  function renderGrid() {
    var q = norm(document.getElementById('q').value);
    var sort = document.getElementById('sort').value;
    var list = rows.filter(function (r) {
      if (langFilter !== 'all' && (r.language || 'en') !== langFilter) return false;
      if (q && norm(r.name).indexOf(q) < 0 && norm(r.set_name).indexOf(q) < 0) return false;
      return true;
    });
    if (sort === 'asc') list.sort(function (a, b) { return a.price - b.price; });
    else if (sort === 'desc') list.sort(function (a, b) { return b.price - a.price; });
    else list.sort(function (a, b) { return String(b.created_at || '') < String(a.created_at || '') ? -1 : 1; });

    if (!rows.length) {
      stateEl.textContent = 'Shop đang cập nhật hàng mới — bạn quay lại sau ít hôm nhé!';
      gridEl.innerHTML = '';
      return;
    }
    stateEl.textContent = list.length
      ? 'Đang có ' + list.length + ' lá đang bán'
      : 'Không tìm thấy lá nào khớp — thử từ khóa khác nhé.';
    gridEl.innerHTML = list.map(tileHTML).join('');
  }

  /* ---------------- khung giỏ hàng / đặt hàng ---------------- */
  var drawer = document.getElementById('cart-drawer');
  var fab = document.getElementById('cart-fab');

  function renderCartUI() {
    var n = cartCount();
    fab.hidden = n === 0;
    document.getElementById('cart-fab-txt').textContent = 'Giỏ hàng · ' + n + ' lá · ' + fmtVND(cartTotal());
    var box = document.getElementById('cart-items');
    var keys = Object.keys(cart);
    if (!keys.length) {
      box.innerHTML = '<p class="cart-empty">Giỏ đang trống — chọn "Thêm vào giỏ" ở lá bạn muốn mua.</p>';
    } else {
      box.innerHTML = keys.map(function (k) {
        var r = rowById[k];
        if (!r) return '';
        return '<div class="cart-line">' +
          '<div class="cl-info"><div class="cl-name">' + esc(r.name) + '</div>' +
          '<div class="cl-sub">' + esc(r.set_name || '') + ' · ' + fmtVND(r.price) + '/lá</div></div>' +
          '<div class="stepper sm">' +
            '<button type="button" data-dec="' + k + '" aria-label="Bớt 1">−</button><span>' + cart[k] + '</span>' +
            '<button type="button" data-inc="' + k + '"' + (cart[k] >= r.qty ? ' disabled' : '') + ' aria-label="Thêm 1">+</button></div>' +
          '<div class="cl-total">' + fmtVND(r.price * cart[k]) + '</div>' +
          '<button type="button" class="cl-x" data-del="' + k + '" aria-label="Bỏ khỏi giỏ">×</button></div>';
      }).join('');
    }
    document.getElementById('cart-sum').textContent = fmtVND(cartTotal());
    document.getElementById('co-submit').disabled = !keys.length;
  }

  function openCart() { drawer.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeCart() { drawer.hidden = true; document.body.style.overflow = ''; }

  function validPhone(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.indexOf('84') === 0 && d.length === 11) d = '0' + d.slice(2);
    return /^0\d{9,10}$/.test(d) ? d : null;
  }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  var lastOrder = null; // {id, code, phone} của đơn vừa gửi — cho nút "Xem trạng thái đơn"
  function rememberOrder(id, phone) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('bct_my_orders') || '[]') || []; } catch (e) { list = []; }
    list = list.filter(function (o) { return o.id !== id; });
    list.unshift({ id: id, code: id.slice(0, 8).toUpperCase(), phone: phone, ts: Date.now() });
    try { localStorage.setItem('bct_my_orders', JSON.stringify(list.slice(0, 10))); } catch (e) {}
  }

  async function submitOrder(ev) {
    ev.preventDefault();
    var msg = document.getElementById('co-msg');
    msg.textContent = '';
    msg.className = 'co-msg';
    if (document.getElementById('co-website').value) return; // honeypot chống bot
    var name = document.getElementById('co-name').value.trim();
    var phone = validPhone(document.getElementById('co-phone').value);
    var address = document.getElementById('co-address').value.trim();
    var note = document.getElementById('co-note').value.trim();
    if (name.length < 2) { msg.textContent = 'Bạn cho shop xin họ tên người nhận.'; msg.classList.add('err'); return; }
    if (!phone) { msg.textContent = 'Số điện thoại chưa đúng — bạn kiểm tra lại giúp shop (10 số, bắt đầu bằng 0).'; msg.classList.add('err'); return; }
    if (address.length < 8) { msg.textContent = 'Bạn ghi địa chỉ nhận hàng cụ thể hơn một chút nhé.'; msg.classList.add('err'); return; }

    // Tải lại danh sách để chốt số lượng theo kho hiện tại trước khi gửi.
    await fetchRows(true);
    var keys = Object.keys(cart);
    if (!keys.length) { msg.textContent = 'Giỏ hàng đã thay đổi (có lá vừa hết) — bạn xem lại giỏ giúp shop.'; msg.classList.add('err'); return; }
    var items = keys.map(function (k) {
      var r = rowById[k];
      return { listing_id: k, card_id: r.card_id, name: r.name, price: r.price, qty: cart[k] };
    });
    var total = items.reduce(function (s, it) { return s + it.price * it.qty; }, 0);

    var orderId = newId();
    var btn = document.getElementById('co-submit');
    btn.disabled = true; btn.textContent = 'Đang gửi đơn…';
    try {
      var res = await fetch(window.SUPABASE_URL + '/rest/v1/store_orders', {
        method: 'POST',
        headers: {
          'apikey': window.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          id: orderId,
          customer_name: name, phone: phone, address: address, note: note,
          items: items, total: total, status: 'new'
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      cart = {}; saveCart();
      lastOrder = { id: orderId, code: orderId.slice(0, 8).toUpperCase(), phone: phone };
      rememberOrder(orderId, phone);
      renderMyOrders();
      renderGrid(); renderCartUI();
      document.getElementById('cart-main').hidden = true;
      var ok = document.getElementById('cart-success');
      ok.hidden = false;
      document.getElementById('success-total').textContent = fmtVND(total);
      document.getElementById('success-code').textContent = lastOrder.code;
    } catch (e) {
      msg.textContent = 'Gửi đơn chưa được — bạn thử lại sau ít phút, hoặc nhắn Messenger/Zalo cho shop để đặt trực tiếp.';
      msg.classList.add('err');
      btn.disabled = false; btn.textContent = 'Gửi đơn đặt hàng';
    }
  }

  async function fetchRows(silent) {
    var url = window.SUPABASE_URL + '/rest/v1/storefront_listings?select=*&order=created_at.desc&limit=500';
    var res = await fetch(url, {
      headers: {
        'apikey': window.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY
      }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    rows = await res.json();
    rowById = {};
    rows.forEach(function (r) { rowById[r.listing_id] = r; });
    pruneCart();
    if (!silent) renderGrid();
    renderCartUI();
  }

  function renderContact() {
    var box = document.getElementById('shop-contact');
    var html = '';
    if (window.SHOP_MESSENGER_URL) html += '<a class="contact-btn primary" href="' + esc(window.SHOP_MESSENGER_URL) + '" target="_blank" rel="noopener">Messenger</a>';
    if (window.SHOP_ZALO_URL) html += '<a class="contact-btn" href="' + esc(window.SHOP_ZALO_URL) + '" target="_blank" rel="noopener">Zalo</a>';
    box.innerHTML = html;
  }

  async function load() {
    renderContact();
    try { await fetchRows(false); }
    catch (e) {
      stateEl.textContent = 'Chưa tải được danh sách hàng — bạn thử tải lại trang sau ít phút nhé.';
      stateEl.classList.add('err');
    }
  }

  document.getElementById('q').addEventListener('input', renderGrid);
  document.getElementById('sort').addEventListener('change', renderGrid);
  document.getElementById('lang-chips').addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    langFilter = btn.getAttribute('data-lang');
    Array.prototype.forEach.call(this.querySelectorAll('.chip'), function (c) {
      c.classList.toggle('on', c === btn);
    });
    renderGrid();
  });

  // Thêm/bớt số lượng — ủy quyền sự kiện cho cả lưới và khung giỏ.
  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    var inc = e.target.closest('[data-inc]');
    var dec = e.target.closest('[data-dec]');
    var del = e.target.closest('[data-del]');
    if (add) setQty(add.getAttribute('data-add'), (cart[add.getAttribute('data-add')] || 0) + 1);
    else if (inc) setQty(inc.getAttribute('data-inc'), (cart[inc.getAttribute('data-inc')] || 0) + 1);
    else if (dec) setQty(dec.getAttribute('data-dec'), (cart[dec.getAttribute('data-dec')] || 0) - 1);
    else if (del) setQty(del.getAttribute('data-del'), 0);
  });

  fab.addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  drawer.addEventListener('click', function (e) { if (e.target === drawer) closeCart(); });
  document.getElementById('co-form').addEventListener('submit', submitOrder);
  document.getElementById('success-close').addEventListener('click', function () {
    document.getElementById('cart-success').hidden = true;
    document.getElementById('cart-main').hidden = false;
    closeCart();
  });
  document.getElementById('success-track').addEventListener('click', function () {
    document.getElementById('cart-success').hidden = true;
    document.getElementById('cart-main').hidden = false;
    closeCart();
    if (lastOrder) {
      document.getElementById('track-code').value = lastOrder.code;
      document.getElementById('track-phone').value = lastOrder.phone;
      trackOrder();
      document.querySelector('.track-box').scrollIntoView({ behavior: 'smooth' });
    }
  });

  /* ---------------- tra cứu đơn (mã đơn + SĐT) ---------------- */
  var TRACK_STATUS = {
    new: '⏳ Chờ shop xác nhận',
    done: '✅ Đã xác nhận — shop sẽ liên hệ để giao hàng',
    cancelled: '❌ Đơn đã hủy'
  };
  function renderMyOrders() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('bct_my_orders') || '[]') || []; } catch (e) { list = []; }
    var box = document.getElementById('my-orders');
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<span class="my-label">Đơn của tôi trên máy này:</span> ' + list.map(function (o) {
      return '<button type="button" class="chip" data-mycode="' + esc(o.code) + '" data-myphone="' + esc(o.phone) + '">Đơn ' + esc(o.code) + '</button>';
    }).join(' ');
  }
  // Nếu đơn web đã được shop chuyển thành đơn bán, ưu tiên hiện TIẾN ĐỘ
  // của đơn bán (xác nhận → đóng gói → vận chuyển → hoàn thành).
  var TRACK_ORDER_STATUS = {
    new: '✅ Đã xác nhận', confirmed: '✅ Đã xác nhận',
    packing: '📦 Đang đóng gói', shipping: '🚚 Đang vận chuyển',
    done: '🎉 Đã giao thành công', cancelled: '❌ Đơn đã hủy'
  };
  function trackStatusLabel(data) {
    if (data.order_status && TRACK_ORDER_STATUS[data.order_status]) return TRACK_ORDER_STATUS[data.order_status];
    return TRACK_STATUS[data.status] || data.status;
  }
  function trackCardHTML(data) {
    var when = data.created_at ? new Date(data.created_at) : null;
    var whenTxt = when ? when.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    var lines = (data.items || []).map(function (it) {
      return '<div class="cart-line"><div class="cl-info"><div class="cl-name">' + esc(it.name || '') + '</div>' +
        '<div class="cl-sub">' + fmtVND(it.price) + ' × ' + it.qty + '</div></div>' +
        '<div class="cl-total">' + fmtVND((Number(it.price) || 0) * (Number(it.qty) || 0)) + '</div></div>';
    }).join('');
    return '<div class="track-card">' +
      '<div class="track-status">' + trackStatusLabel(data) + '</div>' +
      '<div class="cl-sub">Đơn ' + esc(String(data.code || '').toUpperCase()) + ' · ' + esc(data.customer_name || '') + (whenTxt ? ' · đặt lúc ' + whenTxt : '') + '</div>' +
      lines +
      '<div class="cart-sumrow"><span>Tiền hàng</span><span>' + fmtVND(data.total) + '</span></div>' +
      (Number(data.shipping_fee) > 0 ? '<div class="cart-sumrow"><span>Phí ship</span><span>' + fmtVND(data.shipping_fee) + '</span></div>' : '') +
      '<div class="cart-sumrow"><span><b>Tổng cộng</b></span><b>' + fmtVND((Number(data.total) || 0) + (Number(data.shipping_fee) || 0)) + '</b></div>' +
      '</div>';
  }
  async function trackOrder() {
    var box = document.getElementById('track-result');
    var code = document.getElementById('track-code').value.trim();
    var phoneRaw = document.getElementById('track-phone').value.trim();
    var body;
    if (code) {
      body = { p_code: code, p_phone: null }; // có mã đơn thì tra theo mã, không cần SĐT
    } else if (phoneRaw) {
      var phone = validPhone(phoneRaw);
      if (!phone) { box.innerHTML = '<p class="track-err">Số điện thoại chưa đúng định dạng — bạn kiểm tra lại giúp shop nhé.</p>'; return; }
      body = { p_code: null, p_phone: phone };
    } else {
      box.innerHTML = '<p class="track-err">Bạn nhập mã đơn hoặc số điện thoại đã dùng khi đặt hàng giúp shop nhé.</p>';
      return;
    }
    box.innerHTML = '<p class="track-hint">Đang tra cứu…</p>';
    try {
      var res = await fetch(window.SUPABASE_URL + '/rest/v1/rpc/track_store_orders', {
        method: 'POST',
        headers: {
          'apikey': window.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var list = await res.json();
      if (!Array.isArray(list) || !list.length) {
        box.innerHTML = '<p class="track-err">Không tìm thấy đơn — kiểm tra lại mã đơn hoặc số điện thoại (phải là số đã dùng khi đặt).</p>';
        return;
      }
      box.innerHTML = (list.length > 1 ? '<p class="track-hint">Tìm thấy ' + list.length + ' đơn:</p>' : '') +
        list.map(trackCardHTML).join('');
    } catch (e) {
      box.innerHTML = '<p class="track-err">Tra cứu chưa được — bạn thử lại sau ít phút nhé.</p>';
    }
  }
  document.getElementById('track-btn').addEventListener('click', trackOrder);
  document.getElementById('my-orders').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mycode]');
    if (!btn) return;
    document.getElementById('track-code').value = btn.getAttribute('data-mycode');
    document.getElementById('track-phone').value = btn.getAttribute('data-myphone');
    trackOrder();
  });
  (function prefillFromHash() {
    var m = String(location.hash || '').match(/#don-([0-9a-fA-F-]{8,36})/);
    if (m) document.getElementById('track-code').value = m[1].slice(0, 8).toUpperCase();
  })();
  renderMyOrders();

  load();
})();
