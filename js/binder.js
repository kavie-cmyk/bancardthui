/* Build Your Binder — BẢN BẤM THỬ.
 * Danh sách lá của set lấy thật từ TCGdex (tên + số + ảnh).
 * Tồn kho & giá là DỮ LIỆU MẪU sinh tất định theo từng lá (hash id) để xem
 * cảm giác; bản thật sẽ thay bằng storefront_listings + giỏ hàng thật.
 */
(function () {
  'use strict';

  var SETS = [
    { id: 'sv03.5', lang: 'en', label: 'Scarlet & Violet — 151 (Bản Anh)' },
    { id: 'sv08', lang: 'en', label: 'Surging Sparks (Bản Anh)' },
    { id: 'sm10', lang: 'en', label: 'Unbroken Bonds (Bản Anh)' },
    { id: 'sv4a', lang: 'ja', label: 'Shiny Treasure ex (Bản Nhật)' }
  ];
  var PAGE_SIZE = 9;
  var LS_KEY = 'bct_binder_proto_v1';

  var els = {
    select: document.getElementById('set-select'),
    info: document.getElementById('set-info'),
    state: document.getElementById('binder-state'),
    pockets: document.getElementById('pockets'),
    pager: document.getElementById('pager'),
    prev: document.getElementById('page-prev'),
    next: document.getElementById('page-next'),
    pageLabel: document.getElementById('page-label'),
    trayList: document.getElementById('tray-list'),
    trayEmpty: document.getElementById('tray-empty'),
    trayCount: document.getElementById('tray-count'),
    traySetpct: document.getElementById('tray-setpct'),
    trayBar: document.getElementById('tray-bar'),
    trayNote: document.getElementById('tray-note'),
    trayTotal: document.getElementById('tray-total'),
    trayBuy: document.getElementById('tray-buy'),
    trayClear: document.getElementById('tray-clear'),
    trayBought: document.getElementById('tray-bought')
  };

  var cache = {};          // setId -> cards[]
  var picksBySet = loadPicks(); // setId -> [cardId]
  var cur = { set: SETS[0], cards: [], page: 0 };

  function loadPicks() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function savePicks() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(picksBySet)); } catch (e) {}
  }
  function picks() {
    if (!picksBySet[cur.set.id]) picksBySet[cur.set.id] = [];
    return picksBySet[cur.set.id];
  }

  function fmt(n) { return n.toLocaleString('vi-VN') + '₫'; }

  // Hash tất định theo id lá → cùng một lá luôn cho cùng tồn kho/giá mẫu.
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; }
    return h;
  }
  function simStock(card) {
    var h = hash(card.id);
    if (h % 100 >= 40) return null; // ~40% lá "shop có"
    var qty = 1 + ((h >> 8) % 4);
    var tier = (h >> 16) % 100, r = (h >> 5) % 25, price;
    if (tier < 55) price = 15000 + r * 5000;
    else if (tier < 85) price = 150000 + ((h >> 5) % 20) * 25000;
    else price = 700000 + ((h >> 5) % 12) * 250000;
    price = Math.round(price / 1000) * 1000;
    return { qty: qty, price: price };
  }

  function setState(msg, isErr) {
    els.state.hidden = !msg;
    els.state.textContent = msg || '';
    els.state.className = 'shop-state' + (isErr ? ' err' : '');
  }

  function loadSet(setDef) {
    cur.set = setDef; cur.page = 0;
    els.trayBought.hidden = true;
    if (cache[setDef.id]) { cur.cards = cache[setDef.id]; afterLoad(); return; }
    setState('Đang tải lá của set…');
    els.pockets.innerHTML = ''; els.pager.hidden = true;
    els.info.textContent = 'Đang tải…';
    fetch('https://api.tcgdex.net/v2/' + setDef.lang + '/sets/' + setDef.id)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var cards = (data.cards || []).map(function (c) {
          return { id: c.id, localId: c.localId, name: c.name, img: c.image || '', stock: null };
        });
        cards.sort(function (a, b) { return (parseInt(a.localId, 10) || 0) - (parseInt(b.localId, 10) || 0); });
        cards.forEach(function (c) { c.stock = simStock(c); });
        cache[setDef.id] = cards;
        if (cur.set.id === setDef.id) { cur.cards = cards; afterLoad(); }
      })
      .catch(function () {
        if (cur.set.id !== setDef.id) return;
        setState('Không tải được danh sách lá từ TCGdex. Kiểm tra mạng rồi bấm thử lại.', true);
        els.pockets.innerHTML = '';
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = 'Thử tải lại'; b.className = 'chip';
        b.addEventListener('click', function () { loadSet(setDef); });
        els.pockets.appendChild(b);
      });
  }

  function afterLoad() {
    setState('');
    var avail = cur.cards.filter(function (c) { return !!c.stock; }).length;
    els.info.textContent = 'Set gồm ' + cur.cards.length + ' lá · Shop (mẫu) đang có ' + avail + ' lá · Lật trang bằng nút hoặc phím ← →';
    render();
  }

  function pageCount() { return Math.max(1, Math.ceil(cur.cards.length / PAGE_SIZE)); }

  function render() {
    renderPockets();
    renderTray();
    var pc = pageCount();
    if (cur.page >= pc) cur.page = pc - 1;
    els.pager.hidden = cur.cards.length === 0;
    els.pageLabel.textContent = 'Trang ' + (cur.page + 1) + ' / ' + pc;
    els.prev.disabled = cur.page <= 0;
    els.next.disabled = cur.page >= pc - 1;
  }

  function renderPockets() {
    els.pockets.innerHTML = '';
    var picked = picks();
    var slice = cur.cards.slice(cur.page * PAGE_SIZE, cur.page * PAGE_SIZE + PAGE_SIZE);
    slice.forEach(function (card) {
      var isPicked = picked.indexOf(card.id) >= 0;
      var el = document.createElement(card.stock ? 'button' : 'div');
      el.className = 'pocket' + (card.stock ? '' : ' off') + (isPicked ? ' picked' : '');
      if (card.stock) el.type = 'button';

      var wrap = document.createElement('div'); wrap.className = 'p-imgwrap';
      if (card.img) {
        var img = document.createElement('img');
        img.src = card.img + '/low.webp'; img.alt = card.name; img.loading = 'lazy';
        img.addEventListener('error', function () {
          if (!img.dataset.high) { img.dataset.high = '1'; img.src = card.img + '/high.webp'; return; }
          wrap.innerHTML = ''; var ph = document.createElement('span');
          ph.className = 'p-ph'; ph.textContent = card.name; wrap.appendChild(ph);
        });
        wrap.appendChild(img);
      } else {
        var ph = document.createElement('span'); ph.className = 'p-ph'; ph.textContent = card.name;
        wrap.appendChild(ph);
      }
      if (!card.stock) {
        var veil = document.createElement('span'); veil.className = 'p-veil'; veil.textContent = 'SHOP CHƯA CÓ';
        wrap.appendChild(veil);
      }
      el.appendChild(wrap);

      if (isPicked) {
        var badge = document.createElement('span'); badge.className = 'p-badge'; badge.textContent = '✓ ĐÃ CHỌN';
        el.appendChild(badge);
      }

      var name = document.createElement('div'); name.className = 'p-name';
      var num = document.createElement('span'); num.className = 'p-num'; num.textContent = '#' + card.localId + ' · ';
      name.appendChild(num); name.appendChild(document.createTextNode(card.name));
      el.appendChild(name);

      var foot = document.createElement('div'); foot.className = 'p-foot';
      if (card.stock) {
        var price = document.createElement('span'); price.className = 'p-price'; price.textContent = fmt(card.stock.price);
        var qty = document.createElement('span'); qty.className = 'p-qty'; qty.textContent = 'Còn ' + card.stock.qty;
        foot.appendChild(price); foot.appendChild(qty);
      } else {
        var dash = document.createElement('span'); dash.className = 'p-hint'; dash.textContent = 'Chưa có hàng';
        foot.appendChild(dash);
      }
      el.appendChild(foot);

      if (card.stock) {
        var hint = document.createElement('div'); hint.className = 'p-hint';
        hint.textContent = isPicked ? 'Bấm để bỏ khỏi binder' : 'Bấm để cho vào binder';
        el.appendChild(hint);
        el.addEventListener('click', function () { togglePick(card); });
      }
      els.pockets.appendChild(el);
    });
  }

  function togglePick(card) {
    var arr = picks(), i = arr.indexOf(card.id);
    if (i >= 0) arr.splice(i, 1); else arr.push(card.id);
    els.trayBought.hidden = true;
    savePicks();
    render();
  }

  function renderTray() {
    var arr = picks();
    var byId = {};
    cur.cards.forEach(function (c) { byId[c.id] = c; });
    var chosen = arr.map(function (id) { return byId[id]; }).filter(Boolean);
    var total = chosen.reduce(function (s, c) { return s + (c.stock ? c.stock.price : 0); }, 0);
    var avail = cur.cards.filter(function (c) { return !!c.stock; }).length;

    els.trayList.innerHTML = '';
    chosen.forEach(function (card) {
      var row = document.createElement('div'); row.className = 'tray-row';
      var img = document.createElement('img'); img.src = card.img + '/low.webp'; img.alt = ''; img.loading = 'lazy';
      var mid = document.createElement('div');
      var nm = document.createElement('div'); nm.className = 't-name'; nm.textContent = card.name;
      var sub = document.createElement('div'); sub.className = 't-sub'; sub.textContent = '#' + card.localId + ' · ' + cur.set.label;
      mid.appendChild(nm); mid.appendChild(sub);
      var pr = document.createElement('span'); pr.className = 't-price'; pr.textContent = fmt(card.stock.price);
      var x = document.createElement('button'); x.type = 'button'; x.className = 't-x'; x.textContent = '×';
      x.setAttribute('aria-label', 'Bỏ ' + card.name + ' khỏi binder');
      x.addEventListener('click', function () { togglePick(card); });
      row.appendChild(img); row.appendChild(mid); row.appendChild(pr); row.appendChild(x);
      els.trayList.appendChild(row);
    });

    els.trayEmpty.hidden = chosen.length > 0;
    els.trayCount.textContent = 'Đã chọn ' + chosen.length + ' lá';
    els.traySetpct.textContent = avail ? ('shop có ' + avail + '/' + cur.cards.length + ' lá của set') : '';
    els.trayBar.style.width = avail ? Math.round(chosen.length / avail * 100) + '%' : '0%';
    var pagePicked = cur.cards.slice(cur.page * PAGE_SIZE, cur.page * PAGE_SIZE + PAGE_SIZE)
      .filter(function (c) { return arr.indexOf(c.id) >= 0; }).length;
    els.trayNote.textContent = cur.cards.length ? ('Trang binder hiện tại: đã chọn ' + pagePicked + '/9 ô · Thanh tiến độ = lá đã chọn / lá shop đang có') : '';
    els.trayTotal.textContent = fmt(total);
    els.trayBuy.disabled = chosen.length === 0;
    els.trayClear.disabled = chosen.length === 0;
    els.trayBuy.textContent = chosen.length ? ('Mua cả binder (' + chosen.length + ' lá) →') : 'Mua cả binder →';
  }

  els.prev.addEventListener('click', function () { if (cur.page > 0) { cur.page--; render(); } });
  els.next.addEventListener('click', function () { if (cur.page < pageCount() - 1) { cur.page++; render(); } });
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') els.prev.click();
    if (e.key === 'ArrowRight') els.next.click();
  });
  els.select.addEventListener('change', function () {
    var def = SETS.filter(function (s) { return s.id === els.select.value; })[0];
    if (def) loadSet(def);
  });
  els.trayClear.addEventListener('click', function () {
    picksBySet[cur.set.id] = []; els.trayBought.hidden = true; savePicks(); render();
  });
  els.trayBuy.addEventListener('click', function () {
    els.trayBought.hidden = false;
    els.trayBought.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  SETS.forEach(function (s) {
    var o = document.createElement('option'); o.value = s.id; o.textContent = s.label;
    els.select.appendChild(o);
  });
  loadSet(SETS[0]);
})();
