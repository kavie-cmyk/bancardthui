/* Bán Card Thui — storefront công khai.
 * Đọc DUY NHẤT view `storefront_listings` bằng anon key (không đăng nhập).
 * View đã lọc status='active' và chỉ chứa cột an toàn (không giá vốn,
 * không lô/đơn). Xem supabase/storefront.sql.
 */
(function () {
  'use strict';

  var stateEl = document.getElementById('state');
  var gridEl = document.getElementById('grid');
  var rows = [];
  var langFilter = 'all';

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
  // Ảnh lỗi → thử URL dự phòng tiếp theo; hết thì hiện placeholder.
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

  function tileHTML(r) {
    var cond = r.lot_condition || r.card_condition || '';
    var badges = '';
    if (r.rarity) badges += '<span class="badge gold">' + esc(r.rarity) + '</span>';
    if (r.language && LANG_LABEL[r.language]) badges += '<span class="badge">' + LANG_LABEL[r.language] + '</span>';
    if (r.variant && r.variant !== 'Normal') badges += '<span class="badge">' + esc(r.variant) + '</span>';
    if (r.holo_pattern) badges += '<span class="badge">' + esc(r.holo_pattern) + '</span>';
    if (cond) badges += '<span class="badge">' + esc(cond) + (COND_GLOSS[cond] ? ' · ' + COND_GLOSS[cond] : '') + '</span>';
    if (r.graded_org) badges += '<span class="badge graded">' + esc(r.graded_org) + (r.graded_score ? ' ' + esc(r.graded_score) : '') + '</span>';

    var contact = window.SHOP_MESSENGER_URL || window.SHOP_ZALO_URL || '';
    var buy = contact
      ? '<a class="buy-btn" href="' + esc(contact) + '" target="_blank" rel="noopener">Hỏi mua lá này</a>'
      : '';

    return '<article class="tile">' +
      '<div class="tile-img">' + imgTag(r) + '</div>' +
      '<div class="tile-body">' +
        '<div class="tile-name">' + esc(r.name) + '</div>' +
        '<div class="tile-set">' + esc(r.set_name || '') + (r.number ? ' · #' + esc(r.number) : '') + '</div>' +
        (badges ? '<div class="badges">' + badges + '</div>' : '') +
        '<div class="tile-meta"><span class="tile-price">' + fmtVND(r.price) + '</span>' +
        '<span class="tile-qty">Còn ' + (Number(r.qty) || 0) + ' lá</span></div>' +
        buy +
      '</div></article>';
  }

  function render() {
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

  function renderContact() {
    var box = document.getElementById('shop-contact');
    var html = '';
    if (window.SHOP_MESSENGER_URL) html += '<a class="contact-btn primary" href="' + esc(window.SHOP_MESSENGER_URL) + '" target="_blank" rel="noopener">Messenger</a>';
    if (window.SHOP_ZALO_URL) html += '<a class="contact-btn" href="' + esc(window.SHOP_ZALO_URL) + '" target="_blank" rel="noopener">Zalo</a>';
    box.innerHTML = html;
  }

  async function load() {
    renderContact();
    try {
      var url = window.SUPABASE_URL + '/rest/v1/storefront_listings?select=*&order=created_at.desc&limit=500';
      var res = await fetch(url, {
        headers: {
          'apikey': window.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY
        }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      rows = await res.json();
      render();
    } catch (e) {
      stateEl.textContent = 'Chưa tải được danh sách hàng — bạn thử tải lại trang sau ít phút nhé.';
      stateEl.classList.add('err');
    }
  }

  document.getElementById('q').addEventListener('input', render);
  document.getElementById('sort').addEventListener('change', render);
  document.getElementById('lang-chips').addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    langFilter = btn.getAttribute('data-lang');
    Array.prototype.forEach.call(this.querySelectorAll('.chip'), function (c) {
      c.classList.toggle('on', c === btn);
    });
    render();
  });

  load();
})();
