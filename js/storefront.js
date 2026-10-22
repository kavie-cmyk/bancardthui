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
          customer_name: name, phone: phone, address: address, note: note,
          items: items, total: total, status: 'new'
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      cart = {}; saveCart();
      renderGrid(); renderCartUI();
      document.getElementById('cart-main').hidden = true;
      var ok = document.getElementById('cart-success');
      ok.hidden = false;
      document.getElementById('success-total').textContent = fmtVND(total);
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

  load();
})();
