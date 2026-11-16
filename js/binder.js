/* Build Your Binder — BẢN BẤM THỬ Phase 1 + Phase 2.
 * Danh sách lá của set lấy thật từ TCGdex (tên + số + ảnh).
 * Binder 2 lớp: dream (mơ ước, không tính hạng) | verified-scan / verified-buy
 * (đã xác thực, tính giá trị + leaderboard) | buy-pending (đang về binder).
 * Định giá: MỘT nguồn Cardmarket trend qua TCGdex pricing của từng lá,
 * EUR→VND theo EUR_VND trong js/config.js. Không gộp Cardmarket + TCGplayer.
 * Tồn kho, cộng đồng, leaderboard, điểm tương tác của binder mẫu, phần thưởng:
 * DỮ LIỆU MẪU / MÔ PHỎNG (ghi rõ trong banner). Mua = mô phỏng vòng đời đơn.
 * Quét = OCR thật trên máy (Tesseract + js/cardmatch.js + js/cards-dict.js),
 * không khớp được thì có quét mô phỏng ghi rõ là mô phỏng.
 * Thử thách tuần: chủ đề MỞ + điểm tương tác (tim ×1, chia sẻ ×3, xem ×0,2).
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
  var LS_KEY = 'bct_binder_v2';
  var LS_OLD = 'bct_binder_proto_v1';
  var LS_ENG = 'bct_binder_eng_v1';
  var EUR_VND = (typeof window !== 'undefined' && window.EUR_VND) || 28000;
  var VIEW_POINTS_CAP = 10;   // điểm từ lượt xem tối đa 10 điểm / binder (= 50 lượt xem)
  var SHARE_WEEK_CAP = 5;     // mỗi thiết bị tính tối đa 5 lượt chia sẻ / binder / tuần

  function $(id) { return document.getElementById(id); }
  var els = {
    select: $('set-select'), info: $('set-info'), state: $('binder-state'),
    pockets: $('pockets'), pager: $('pager'), prev: $('page-prev'), next: $('page-next'),
    pageLabel: $('page-label'), name: $('display-name'),
    trayList: $('tray-list'), trayEmpty: $('tray-empty'), trayCount: $('tray-count'),
    traySetpct: $('tray-setpct'), trayBar: $('tray-bar'), trayNote: $('tray-note'),
    statVerified: $('stat-verified'), statDream: $('stat-dream'), statPending: $('stat-pending'),
    statValue: $('stat-value'), trayClear: $('tray-clear'),
    scanAny: $('scan-any'), scanFile: $('scan-file'), shareBtn: $('share-btn'), shareNote: $('share-note'),
    exportBtn: $('export-btn'), exportNote: $('export-note'),
    publishBtn: $('publish-btn'), publishNote: $('publish-note'),
    challenge: $('challenge-body'), suggest: $('suggest-body'), lbBody: $('lb-body'),
    community: $('community-body'), featured: $('featured-body'),
    sharedView: $('shared-view'), sharedTitle: $('shared-title'), sharedBody: $('shared-body'),
    sharedLike: $('shared-like'), sharedShare: $('shared-share'), sharedMine: $('shared-mine'),
    sharedNote: $('shared-note'),
    totalBar: $('binder-total'), totalBarVal: $('binder-total-val'), totalBarNote: $('binder-total-note'),
    statTotal: $('stat-total'), statTotalNote: $('stat-total-note'),
    scanPanel: $('scan-panel'), scanStatus: $('scan-status'), scanOcr: $('scan-ocr-text'),
    scanCands: $('scan-cands'), scanSim: $('scan-sim'), scanClose: $('scan-close')
  };

  // ---------- tuần ISO + chủ đề mở ----------
  function isoWeek(d) {
    var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    var firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    var fday = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
    return { year: date.getUTCFullYear(), week: 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000)) };
  }
  var NOW = new Date();
  var WK = isoWeek(NOW);
  var WEEK_KEY = WK.year + '-W' + WK.week;
  function sundayEnd() {
    var d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
    var day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() + (6 - day));
    return d;
  }
  function fmtDate(d) { return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

  var THEMES = [
    { title: 'Binder hệ Lửa', desc: 'Toàn những lá rực lửa — Charizard, Arcanine hay bất cứ lá Lửa nào bạn mê. Tự diễn giải theo cách của bạn!', kw: ['charmander', 'charmeleon', 'charizard', 'flareon', 'vulpix', 'ninetales', 'growlithe', 'arcanine', 'ponyta', 'rapidash', 'magmar', 'moltres', 'entei', 'torchic', 'combusken', 'blaziken'] },
    { title: 'Binder toàn lá cute', desc: 'Một binder nhìn là muốn ôm: Pikachu, Eevee, Mew… tiêu chí duy nhất là “cute theo mắt bạn”.', kw: ['pikachu', 'eevee', 'jigglypuff', 'clefairy', 'togepi', 'pichu', 'chansey', 'mew', 'ditto', 'skitty', 'snorlax', 'psyduck', 'slowpoke', 'wooper'] },
    { title: 'Binder dưới 1 triệu', desc: 'Tổng giá trị binder không quá 1.000.000₫ — khoe tài săn lá đẹp mà ví vẫn vui.', kw: [], under1m: true },
    { title: 'Binder Gen 1', desc: 'Chỉ 151 Pokémon đầu tiên — hoài niệm Kanto, xếp kiểu gì là quyền của bạn.', kw: [], gen1: true },
    { title: 'Binder Eevee & những người bạn', desc: 'Eevee và mọi dạng tiến hoá Eeveelution — đủ bộ hay thiếu vài lá đều được, miễn là có Eevee vibe.', kw: ['eevee', 'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon'] },
    { title: 'Binder lá khủng', desc: 'ex / GX / V / VMAX — những lá “khủng” nhất bạn có, phô trương hết cỡ.', kw: [], big: true }
  ];
  var THEME = THEMES[(WK.week - 1) % THEMES.length];

  // ---------- state ----------
  function uid() { return 'u' + Math.random().toString(36).slice(2, 10); }
  function loadState() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
    if (!s || typeof s !== 'object') s = { v: 2, uid: uid(), name: '', picks: {}, published: false, joined: false };
    if (!s.uid) s.uid = uid();
    if (!s.picks) s.picks = {};
    return s;
  }
  var state = loadState();
  var legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(LS_OLD) || 'null'); } catch (e) {}
  function saveState() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }

  function loadEng() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(LS_ENG) || 'null'); } catch (e) {}
    if (!s || typeof s !== 'object') s = { liked: {}, shareCnt: {}, viewed: {}, extra: {} };
    if (!s.extra) s.extra = {};
    return s;
  }
  var eng = loadEng();
  function saveEng() { try { localStorage.setItem(LS_ENG, JSON.stringify(eng)); } catch (e) {} }
  function extra(key) { if (!eng.extra[key]) eng.extra[key] = { l: 0, s: 0, v: 0 }; return eng.extra[key]; }

  // ---------- dữ liệu mẫu cộng đồng ----------
  var SAMPLES = [
    { key: 's1', owner: 'Minh Anh', setId: 'sv03.5', names: ['Charizard ex', 'Mew ex', 'Pikachu', 'Eevee', 'Snorlax', 'Dragonite', 'Bulbasaur', 'Charmander', 'Squirtle'], verified: 14, value: 4850000, pct: 8.5, likes: 42, wk: { l: 18, s: 6, v: 120 }, joined: true, shopPick: false },
    { key: 's2', owner: 'Kaito_VN', setId: 'sv08', names: ['Pikachu ex', 'Milotic ex', 'Eevee', 'Palafin', 'Duraludon', 'Archaludon ex'], verified: 9, value: 2970000, pct: 4.7, likes: 27, wk: { l: 11, s: 3, v: 64 }, joined: true, shopPick: false },
    { key: 's3', owner: 'Bự Sưu Tầm', setId: 'sm10', names: ['Reshiram & Charizard GX', 'Charizard', 'Pikachu', 'Snorlax', 'Mewtwo', 'Gengar'], verified: 11, value: 3620000, pct: 5.2, likes: 35, wk: { l: 14, s: 5, v: 88 }, joined: true, shopPick: true },
    { key: 's4', owner: 'Hana.chan', setId: 'sv4a', names: ['ピカチュウ', 'ミュウex', 'リザードンex', 'イーブイ', 'カビゴン'], verified: 7, value: 1980000, pct: 3.7, likes: 19, wk: { l: 7, s: 2, v: 41 }, joined: true, shopPick: false },
    { key: 's5', owner: 'Tuấn Poké', setId: 'sv03.5', names: ['Venusaur ex', 'Blastoise ex', 'Alakazam ex', 'Zapdos ex', 'Gengar'], verified: 6, value: 1240000, pct: 3.6, likes: 8, wk: { l: 3, s: 1, v: 22 }, joined: false, shopPick: false }
  ];
  function sampleEng(sm) {
    var ex = extra(sm.key);
    return { likes: sm.likes + ex.l, wkLikes: sm.wk.l + ex.l, wkShares: sm.wk.s + ex.s, wkViews: sm.wk.v + ex.v };
  }
  function pointsOf(likes, shares, views) {
    return Math.round((likes + shares * 3 + Math.min(views * 0.2, VIEW_POINTS_CAP)) * 10) / 10;
  }
  function samplePoints(sm) { var e = sampleEng(sm); return pointsOf(e.wkLikes, e.wkShares, e.wkViews); }
  function myEng() { var ex = extra('me'); return { likes: ex.l, wkLikes: ex.l, wkShares: ex.s, wkViews: ex.v }; }
  function myPoints() { var e = myEng(); return pointsOf(e.wkLikes, e.wkShares, e.wkViews); }
  function wkViewsOf(key) {
    if (key === 'me') return myEng().wkViews;
    var sm = SAMPLES.filter(function (s) { return s.key === key; })[0];
    if (sm) return sampleEng(sm).wkViews;
    return extra(key).v;
  }

  // ---------- helpers ----------
  function fmt(n) { return Math.round(n).toLocaleString('vi-VN') + '₫'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; } return h; }
  function simStock(card) {
    var h = hash(card.id);
    if (h % 100 >= 40) return null;
    var qty = 1 + ((h >> 8) % 4);
    var tier = (h >> 16) % 100, r = (h >> 5) % 25, price;
    if (tier < 55) price = 15000 + r * 5000;
    else if (tier < 85) price = 150000 + ((h >> 5) % 20) * 25000;
    else price = 700000 + ((h >> 5) % 12) * 250000;
    return { qty: qty, price: Math.round(price / 1000) * 1000 };
  }
  var ST_LABEL = {
    'dream': '○ Mơ ước', 'verified-scan': '✓ Đã xác thực · Quét thẻ',
    'verified-buy': '✓ Mua tại shop', 'buy-pending': '🚚 Đang về binder'
  };
  function isVerified(st) { return st === 'verified-scan' || st === 'verified-buy'; }

  // ---------- giá HIỂN THỊ ở màn xem binder (khác "Giá trị binder" leaderboard) ----------
  // Ưu tiên: shop CÓ HÀNG -> giá shop (mẫu); KHÔNG có hàng -> giá thị trường
  // Cardmarket trend (TCGdex). Tồn kho mẫu là tất định theo id (simStock) nên
  // tra được ngay cả khi set chưa tải xong.
  function stockForId(id) {
    var c = cardReg[id];
    if (c) return c.stock;
    return simStock({ id: id });
  }
  function displayPrice(id) {
    var st = stockForId(id);
    if (st) return { kind: 'shop', vnd: st.price, qty: st.qty };
    var ps = priceState[id];
    if (ps && ps.st === 'ok') return { kind: 'market', vnd: ps.vnd };
    if (ps && ps.st === 'loading') return { kind: 'loading' };
    return { kind: 'none' };
  }
  function displayPriceText(id) {
    var d = displayPrice(id);
    if (d.kind === 'shop') return { text: fmt(d.vnd), label: 'Giá shop (mẫu) · Còn ' + d.qty };
    if (d.kind === 'market') return { text: fmt(d.vnd), label: 'Giá thị trường · Cardmarket · TCGdex' };
    if (d.kind === 'loading') return { text: 'Đang lấy giá thị trường…', label: 'Giá thị trường · Cardmarket · TCGdex' };
    return { text: 'Chưa có giá thị trường', label: 'Giá thị trường · Cardmarket · TCGdex' };
  }
  // Tổng giá HIỂN THỊ của 1 binder: cộng giá đang hiển thị của mọi lá
  // (giá shop nếu có hàng, còn lại giá thị trường). Lá chưa có giá nào -> không tính.
  function displayTotal(items) {
    var total = 0, priced = 0, unpriced = 0;
    (items || []).forEach(function (it) {
      if (!it || !it.id) { unpriced++; return; }
      var d = displayPrice(it.id);
      if (d.kind === 'shop' || d.kind === 'market') { total += d.vnd; priced++; }
      else unpriced++;
    });
    return { total: total, priced: priced, unpriced: unpriced };
  }
  var TOTAL_LABEL = 'Tổng giá binder (giá shop nếu có hàng, còn lại giá thị trường)';

  var cache = {};
  var cardReg = {};
  var cur = { set: SETS[0], cards: [], page: 0 };
  var priceState = {};

  function picksOf(setId) { if (!state.picks[setId]) state.picks[setId] = []; return state.picks[setId]; }
  function allPicks() {
    var out = [];
    Object.keys(state.picks).forEach(function (sid) { state.picks[sid].forEach(function (p) { out.push(p); }); });
    return out;
  }
  function findPick(setId, cardId) {
    var arr = picksOf(setId);
    for (var i = 0; i < arr.length; i++) if (arr[i].id === cardId) return arr[i];
    return null;
  }
  function addPick(card, st) {
    var p = findPick(card.setId, card.id);
    if (p) { if (st) p.st = st; saveState(); return p; }
    p = { id: card.id, setId: card.setId, name: card.name, img: card.img, localId: card.localId, st: st || 'dream' };
    picksOf(card.setId).push(p);
    saveState();
    return p;
  }
  function removePick(setId, cardId) {
    state.picks[setId] = picksOf(setId).filter(function (p) { return p.id !== cardId; });
    saveState();
  }

  // ---------- giá thật: Cardmarket trend qua TCGdex ----------
  // Giá fetch cho MỌI lá đã vào binder (kể cả mơ ước — hiện giá tham khảo mờ,
  // KHÔNG tính tổng) và cho 9 lá đang hiện trên lưới. Trước đây chỉ fetch lá
  // đã xác thực nên lá mơ ước + lưới set không bao giờ hiện giá thật.
  function ensurePrice(pick) {
    if (priceState[pick.id]) return;
    priceState[pick.id] = { st: 'loading', vnd: 0 };
    var setDef = SETS.filter(function (s) { return s.id === pick.setId; })[0] || cur.set;
    fetch('https://api.tcgdex.net/v2/' + setDef.lang + '/cards/' + encodeURIComponent(pick.id))
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var entries = (window.BCTPricing && data.pricing) ? window.BCTPricing.fromTcgdex(data.pricing) : [];
        var cm = null;
        entries.forEach(function (e) { if (e.source === 'cardmarket') cm = e; });
        if (cm) priceState[pick.id] = { st: 'ok', vnd: Math.round(cm.price * EUR_VND / 1000) * 1000, eur: cm.price };
        else priceState[pick.id] = { st: 'none', vnd: 0 };
      })
      .catch(function () { priceState[pick.id] = { st: 'none', vnd: 0 }; })
      .then(function () {
        renderTray(); renderSocial(); updateSharedPrices();
        if (cur.cards.some(function (c) { return c.id === pick.id; })) { renderPockets(); renderSuggest(); }
      });
  }
  function myValue() {
    var total = 0;
    allPicks().forEach(function (p) {
      if (!isVerified(p.st)) return;
      var ps = priceState[p.id];
      if (ps && ps.st === 'ok') total += ps.vnd;
    });
    return total;
  }
  function priceLine(pick) {
    var d = displayPrice(pick.id);
    if (d.kind === 'shop') return { text: fmt(d.vnd), note: 'Giá shop (mẫu)' };
    if (d.kind === 'market') return { text: fmt(d.vnd), note: 'Giá thị trường · Cardmarket · TCGdex' };
    if (d.kind === 'loading') return { text: 'Đang lấy giá thị trường…', note: 'Giá thị trường · Cardmarket · TCGdex' };
    return { text: 'Chưa có giá thị trường', note: 'Giá thị trường · Cardmarket · TCGdex' };
  }

  // ---------- tải set ----------
  function setState(msg, isErr) {
    els.state.hidden = !msg;
    els.state.textContent = msg || '';
    els.state.className = 'shop-state' + (isErr ? ' err' : '');
  }
  var fetchPromises = {};
  function fetchSetData(setDef) {
    if (cache[setDef.id]) return Promise.resolve(cache[setDef.id]);
    if (fetchPromises[setDef.id]) return fetchPromises[setDef.id];
    fetchPromises[setDef.id] = fetch('https://api.tcgdex.net/v2/' + setDef.lang + '/sets/' + setDef.id)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var cards = (data.cards || []).map(function (c) {
          return { id: c.id, localId: c.localId, name: c.name, img: c.image || '', setId: setDef.id, lang: setDef.lang, stock: null };
        });
        cards.sort(function (a, b) { return (parseInt(a.localId, 10) || 0) - (parseInt(b.localId, 10) || 0); });
        cards.forEach(function (c) { c.stock = simStock(c); cardReg[c.id] = c; });
        cache[setDef.id] = cards;
        migrateLegacy(setDef, cards);
        renderSocial();
        return cards;
      });
    return fetchPromises[setDef.id];
  }
  function loadSet(setDef) {
    cur.set = setDef; cur.page = 0;
    if (cache[setDef.id]) { cur.cards = cache[setDef.id]; afterLoad(); return Promise.resolve(); }
    setState('Đang tải lá của set…');
    els.pockets.innerHTML = ''; els.pager.hidden = true;
    els.info.textContent = 'Đang tải…';
    return fetchSetData(setDef)
      .then(function (cards) {
        if (cur.set.id === setDef.id) { cur.cards = cards; afterLoad(); }
      })
      .catch(function () {
        if (cur.set.id !== setDef.id) return;
        setState('Không tải được danh sách lá từ TCGdex. Kiểm tra mạng rồi bấm thử lại.', true);
        els.pockets.innerHTML = '';
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = 'Thử tải lại'; b.className = 'chip';
        b.addEventListener('click', function () { delete fetchPromises[setDef.id]; loadSet(setDef); });
        els.pockets.appendChild(b);
      });
  }
  function migrateLegacy(setDef, cards) {
    if (!legacy || !Array.isArray(legacy[setDef.id])) return;
    var byId = {};
    cards.forEach(function (c) { byId[c.id] = c; });
    legacy[setDef.id].forEach(function (id) { if (byId[id]) addPick(byId[id], 'dream'); });
    delete legacy[setDef.id];
    saveState();
  }
  function afterLoad() {
    setState('');
    var avail = cur.cards.filter(function (c) { return !!c.stock; }).length;
    els.info.textContent = 'Set gồm ' + cur.cards.length + ' lá · Shop (mẫu) đang có ' + avail + ' lá · Lật trang bằng nút hoặc phím ← →';
    render();
  }
  function pageCount() { return Math.max(1, Math.ceil(cur.cards.length / PAGE_SIZE)); }
  function render() { renderPockets(); renderTray(); renderSuggest(); renderSocial(); }

  // ---------- lưới binder ----------
  function renderPockets() {
    els.pockets.innerHTML = '';
    var slice = cur.cards.slice(cur.page * PAGE_SIZE, cur.page * PAGE_SIZE + PAGE_SIZE);
    slice.forEach(function (card) { ensurePrice(card); });
    slice.forEach(function (card) {
      var pick = findPick(card.setId, card.id);
      var el = document.createElement('div');
      el.className = 'pocket' + (card.stock ? '' : ' off') + (pick ? ' picked st-' + pick.st : '');

      var main = document.createElement('button');
      main.type = 'button'; main.className = 'p-main';
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
        var ph2 = document.createElement('span'); ph2.className = 'p-ph'; ph2.textContent = card.name; wrap.appendChild(ph2);
      }
      if (!card.stock) {
        var veil = document.createElement('span'); veil.className = 'p-veil'; veil.textContent = 'SHOP CHƯA CÓ';
        wrap.appendChild(veil);
      }
      if (pick && pick.ev) {
        var ev = document.createElement('img'); ev.className = 'p-ev'; ev.src = pick.ev; ev.alt = 'Ảnh chụp lá thật (bằng chứng quét)';
        wrap.appendChild(ev);
      }
      main.appendChild(wrap);
      if (pick) {
        var badge = document.createElement('span'); badge.className = 'p-badge st-' + pick.st;
        badge.textContent = ST_LABEL[pick.st]; el.appendChild(badge);
      }
      var name = document.createElement('div'); name.className = 'p-name';
      var num = document.createElement('span'); num.className = 'p-num'; num.textContent = '#' + card.localId + ' · ';
      name.appendChild(num); name.appendChild(document.createTextNode(card.name));
      main.appendChild(name);
      var foot = document.createElement('div'); foot.className = 'p-foot';
      var dpt = displayPriceText(card.id);
      var rp2 = document.createElement('span'); rp2.className = 'p-price'; rp2.textContent = dpt.text;
      var rs2 = document.createElement('span'); rs2.className = 'p-qty p-price-label'; rs2.textContent = dpt.label;
      foot.appendChild(rp2); foot.appendChild(rs2);
      main.appendChild(foot);
      var hint = document.createElement('div'); hint.className = 'p-hint';
      hint.textContent = pick
        ? (isVerified(pick.st) ? 'Đã xác thực — bỏ ở khay bên phải' : pick.st === 'buy-pending' ? 'Đang về binder — xác nhận ở khay' : '○ Mơ ước — bấm để bỏ khỏi binder')
        : 'Bấm để thêm ○ Mơ ước';
      main.appendChild(hint);
      main.addEventListener('click', function () { toggleDream(card); });
      el.appendChild(main);

      var actions = document.createElement('div'); actions.className = 'p-actions';
      if (card.stock && (!pick || pick.st === 'dream')) {
        var buy = document.createElement('button'); buy.type = 'button'; buy.className = 'mini-btn buy';
        buy.textContent = '🛒 Mua tại shop';
        buy.addEventListener('click', function () { buyCard(card); });
        actions.appendChild(buy);
      }
      if (pick && pick.st === 'dream') {
        var scan = document.createElement('button'); scan.type = 'button'; scan.className = 'mini-btn';
        scan.textContent = '📷 Quét';
        scan.addEventListener('click', function () { openScan(pick); });
        actions.appendChild(scan);
      }
      if (actions.children.length) el.appendChild(actions);
      els.pockets.appendChild(el);
    });
    var pc = pageCount();
    if (cur.page >= pc) cur.page = pc - 1;
    els.pager.hidden = cur.cards.length === 0;
    els.pageLabel.textContent = 'Trang ' + (cur.page + 1) + ' / ' + pc;
    els.prev.disabled = cur.page <= 0;
    els.next.disabled = cur.page >= pc - 1;
  }

  function toggleDream(card) {
    var pick = findPick(card.setId, card.id);
    if (pick) {
      if (pick.st === 'dream') { removePick(card.setId, card.id); render(); }
      return;
    }
    addPick(card, 'dream');
    render();
  }

  // ---------- mua mô phỏng vòng đời đơn ----------
  function buyCard(card) {
    var p = addPick(card, 'buy-pending');
    p.st = 'buy-pending';
    saveState();
    render();
    els.trayNote.textContent = '🚚 Mô phỏng đơn: đã đặt mua “' + card.name + '” — trạng thái “đang về binder”, chưa tính hạng. Khi nhận được hàng, bấm “✓ Đã nhận hàng (Done)” ở khay.';
  }
  function confirmDone(pick) {
    pick.st = 'verified-buy'; delete pick.sim;
    saveState(); ensurePrice(pick); render();
  }

  // ---------- khay binder ----------
  function renderTray() {
    var picks = allPicks();
    picks.forEach(function (p) { ensurePrice(p); });
    var verified = picks.filter(function (p) { return isVerified(p.st); });
    var dream = picks.filter(function (p) { return p.st === 'dream'; });
    var pending = picks.filter(function (p) { return p.st === 'buy-pending'; });

    els.statVerified.textContent = verified.length;
    els.statDream.textContent = dream.length;
    els.statPending.textContent = pending.length;
    els.statValue.textContent = fmt(myValue());
    var dt = displayTotal(picks);
    if (els.statTotal) els.statTotal.textContent = fmt(dt.total);
    if (els.statTotalNote) els.statTotalNote.textContent = dt.unpriced
      ? ('Đã tính ' + dt.priced + '/' + picks.length + ' lá — ' + dt.unpriced + ' lá chưa có giá nào nên chưa tính vào tổng này.')
      : ('Đã tính đủ ' + dt.priced + ' lá. Khác “Giá trị binder” ở trên: tổng này tính MỌI lá theo giá đang hiển thị, còn Giá trị binder chỉ tính lá ✓ đã xác thực theo Cardmarket (dùng cho Leaderboard).');
    if (els.totalBarVal) els.totalBarVal.textContent = fmt(dt.total);
    if (els.totalBarNote) els.totalBarNote.textContent = dt.unpriced
      ? (dt.priced + '/' + picks.length + ' lá có giá · ' + dt.unpriced + ' lá chưa có giá (không tính vào tổng)')
      : ('Tính đủ ' + dt.priced + ' lá trong binder của bạn');

    var inSet = picksOf(cur.set.id);
    els.trayCount.textContent = 'Đã chọn ' + inSet.length + ' lá (set này) · tổng ' + picks.length + ' lá';
    var pctSet = cur.cards.length ? Math.round(verified.filter(function (p) { return p.setId === cur.set.id; }).length / cur.cards.length * 1000) / 10 : 0;
    els.traySetpct.textContent = cur.cards.length ? ('lá thật = ' + pctSet + '% set này') : '';
    els.trayBar.style.width = Math.min(100, pctSet) + '%';
    if (!els.trayNote.textContent || !/Mô phỏng đơn/.test(els.trayNote.textContent)) {
      els.trayNote.textContent = 'Mỗi lá hiện Giá shop (mẫu) nếu shop có hàng, không thì Giá thị trường (Cardmarket · TCGdex). “Tổng giá binder” cộng giá hiển thị của mọi lá; “Giá trị binder” chỉ tính lá ✓ đã xác thực có giá Cardmarket (cho Leaderboard).';
    }

    els.trayList.innerHTML = '';
    picks.slice().sort(function (a, b) { return (isVerified(b.st) ? 1 : 0) - (isVerified(a.st) ? 1 : 0); }).forEach(function (pick) {
      var pl = priceLine(pick);
      var row = document.createElement('div');
      row.className = 'tray-row st-' + pick.st;
      var img = document.createElement('img');
      img.src = (pick.img || '') + '/low.webp'; img.alt = ''; img.loading = 'lazy';
      row.appendChild(img);
      var mid = document.createElement('div');
      var nm = document.createElement('div'); nm.className = 't-name'; nm.textContent = pick.name;
      var sub = document.createElement('div'); sub.className = 't-sub';
      sub.textContent = '#' + pick.localId + ' · ' + ST_LABEL[pick.st] + (pick.sim ? ' · quét mô phỏng (bản thử)' : '');
      var pr = document.createElement('div');
      pr.className = 't-price-line' + (pick.st === 'dream' ? ' dim' : '');
      pr.textContent = pl.text + ' · ' + pl.note;
      mid.appendChild(nm); mid.appendChild(sub); mid.appendChild(pr);
      if (pick.st === 'buy-pending') {
        var done = document.createElement('button'); done.type = 'button'; done.className = 'mini-btn buy';
        done.textContent = '✓ Đã nhận hàng (đơn Done)';
        done.addEventListener('click', function () { confirmDone(pick); });
        mid.appendChild(done);
      }
      if (pick.st === 'dream') {
        var acts = document.createElement('div'); acts.className = 't-acts';
        var sc = document.createElement('button'); sc.type = 'button'; sc.className = 'mini-btn';
        sc.textContent = '📷 Quét';
        sc.addEventListener('click', function () { openScan(pick); });
        acts.appendChild(sc);
        var card = cardReg[pick.id];
        if (card && card.stock) {
          var by = document.createElement('button'); by.type = 'button'; by.className = 'mini-btn buy';
          by.textContent = '🛒 Mua';
          by.addEventListener('click', function () { buyCard(card); });
          acts.appendChild(by);
        }
        mid.appendChild(acts);
      }
      row.appendChild(mid);
      var x = document.createElement('button'); x.type = 'button'; x.className = 't-x'; x.textContent = '×';
      x.setAttribute('aria-label', 'Bỏ ' + pick.name + ' khỏi binder');
      x.addEventListener('click', function () { removePick(pick.setId, pick.id); render(); });
      row.appendChild(x);
      els.trayList.appendChild(row);
    });
    els.trayEmpty.hidden = picks.length > 0;
    els.trayClear.disabled = inSet.length === 0;
    els.publishBtn.textContent = state.published ? '🌐 Đang đăng trên Binder cộng đồng (bấm để rút xuống)' : '🌐 Đăng lên Binder cộng đồng';
  }

  // ---------- gợi ý ----------
  function baseTokens(name) {
    return String(name || '').split(/[^A-Za-zÀ-ỹ0-9]+/).filter(function (t) {
      return t.length > 2 && !/^(ex|gx|vmax|the|and)$/i.test(t);
    }).map(function (t) { return t.toLowerCase(); });
  }
  function suggestCards() {
    var owned = {};
    picksOf(cur.set.id).forEach(function (p) { owned[p.id] = p; });
    var ownedNums = Object.keys(owned).map(function (id) { return parseInt(owned[id].localId, 10) || 0; });
    var ownedTokens = {};
    Object.keys(owned).forEach(function (id) { baseTokens(owned[id].name).forEach(function (t) { ownedTokens[t] = 1; }); });
    var out = [];
    cur.cards.forEach(function (card) {
      if (owned[card.id]) return;
      var num = parseInt(card.localId, 10) || 0;
      var near = ownedNums.some(function (n) { return Math.abs(n - num) >= 1 && Math.abs(n - num) <= 2; });
      var sameMon = baseTokens(card.name).some(function (t) { return ownedTokens[t]; });
      if (!near && !sameMon) return;
      out.push({ card: card, reason: near ? 'Lá kề số với lá bạn đã có' : 'Cùng Pokémon / chuỗi tiến hóa' });
    });
    out.sort(function (a, b) {
      return ((b.card.stock ? 1 : 0) - (a.card.stock ? 1 : 0));
    });
    return out.slice(0, 8);
  }
  function themeCards() {
    var owned = {};
    allPicks().forEach(function (p) { owned[p.id] = 1; });
    var out = [];
    cur.cards.forEach(function (card) {
      if (owned[card.id]) return;
      var nm = card.name.toLowerCase();
      var hit = false;
      if (THEME.gen1) hit = cur.set.id === 'sv03.5';
      else if (THEME.under1m) hit = !!(card.stock && card.stock.price < 1000000);
      else if (THEME.big) hit = /(ex|gx|vmax| v)$/i.test(card.name);
      else hit = THEME.kw.some(function (k) { return nm.indexOf(k) >= 0; });
      if (hit) out.push(card);
    });
    out.sort(function (a, b) { return ((b.stock ? 1 : 0) - (a.stock ? 1 : 0)); });
    return out.slice(0, 6);
  }
  function sugRow(card, reason) {
    ensurePrice(card);
    var row = document.createElement('div'); row.className = 'sug-row';
    var img = document.createElement('img'); img.src = card.img + '/low.webp'; img.alt = ''; img.loading = 'lazy';
    row.appendChild(img);
    var mid = document.createElement('div');
    var nm = document.createElement('div'); nm.className = 't-name'; nm.textContent = '#' + card.localId + ' ' + card.name;
    var sub = document.createElement('div'); sub.className = 't-sub';
    var sugPs = priceState[card.id];
    sub.textContent = reason + (sugPs && sugPs.st === 'ok' ? ' · Giá Cardmarket ' + fmt(sugPs.vnd) : '') + (card.stock ? ' · Shop có hàng (mẫu) ' + fmt(card.stock.price) : ' · Shop chưa có (mẫu)');
    mid.appendChild(nm); mid.appendChild(sub); row.appendChild(mid);
    var add = document.createElement('button'); add.type = 'button'; add.className = 'mini-btn';
    add.textContent = '+ Mơ ước';
    add.addEventListener('click', function () { addPick(card, 'dream'); render(); });
    row.appendChild(add);
    if (card.stock) {
      var buy = document.createElement('button'); buy.type = 'button'; buy.className = 'mini-btn buy';
      buy.textContent = '🛒 Mua';
      buy.addEventListener('click', function () { buyCard(card); });
      row.appendChild(buy);
    }
    return row;
  }
  function renderSuggest() {
    if (!els.suggest) return;
    els.suggest.innerHTML = '';
    if (!cur.cards.length) { els.suggest.textContent = 'Đang tải gợi ý…'; return; }
    var list = suggestCards();
    if (!list.length) {
      els.suggest.innerHTML = '<p class="tray-note">Thêm vài lá vào binder trước — gợi ý sẽ hiện lá kề số, cùng Pokémon / chuỗi tiến hóa, ưu tiên lá shop có hàng.</p>';
      return;
    }
    list.forEach(function (s) { els.suggest.appendChild(sugRow(s.card, s.reason)); });
  }

  // ---------- tương tác (tim / chia sẻ / xem) ----------
  function countView(key, isSelf) {
    if (isSelf) return false;
    if (eng.viewed[key] === WEEK_KEY) return false; // trần: 1 lượt / thiết bị / binder / tuần
    eng.viewed[key] = WEEK_KEY;
    extra(key).v++;
    saveEng();
    return true;
  }
  function doLike(key, isSelf) {
    if (isSelf) return 'Không tự thả tim binder của chính mình được.';
    if (eng.liked[key]) return 'Bạn đã thả tim binder này rồi (tối đa 1 tim / thiết bị).';
    eng.liked[key] = 1;
    extra(key).l++;
    saveEng(); renderSocial();
    return 'Đã thả tim ❤️ (+1 điểm tương tác).';
  }
  // Cộng điểm chia sẻ CHỈ khi hành động chia sẻ đã xác nhận thành công.
  // Trả về true nếu lần này được cộng điểm, false nếu đã chạm trần tuần.
  function awardSharePoint(key) {
    var ck = key + '@' + WEEK_KEY;
    if ((eng.shareCnt[ck] || 0) >= SHARE_WEEK_CAP) return false;
    eng.shareCnt[ck] = (eng.shareCnt[ck] || 0) + 1;
    extra(key).s++;
    saveEng();
    return true;
  }
  function setShareNote(noteEl, text) {
    if (!noteEl) return;
    noteEl.hidden = false;
    noteEl.textContent = text;
  }
  // Ô copy tay: hiện link trong input readonly ngay dưới note để người dùng
  // tự copy khi cả native share lẫn clipboard đều bị trình duyệt chặn.
  function showManualLink(noteEl, link) {
    if (!noteEl || !noteEl.parentNode) return;
    var box = noteEl._shareBox;
    if (!box) {
      box = document.createElement('div'); box.className = 'share-manual';
      var label = document.createElement('p'); label.className = 'tray-note share-manual-label';
      label.textContent = '👇 Không copy tự động được — chạm vào ô dưới, bôi đen hết rồi bấm Copy để tự copy link này:';
      var input = document.createElement('input'); input.type = 'text'; input.readOnly = true;
      input.className = 'share-manual-input'; input.setAttribute('aria-label', 'Link binder để copy thủ công');
      input.addEventListener('focus', function () { input.select(); });
      input.addEventListener('click', function () { input.focus(); input.select(); });
      box.appendChild(label); box.appendChild(input);
      noteEl.parentNode.insertBefore(box, noteEl.nextSibling);
      noteEl._shareBox = box; box._input = input;
    }
    box.hidden = false;
    box._input.value = link;
    if (box.scrollIntoView) { try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
  }
  function hideManualLink(noteEl) { if (noteEl && noteEl._shareBox) noteEl._shareBox.hidden = true; }
  // Copy clipboard, trả Promise<boolean>: true CHỈ khi copy thật sự thành công
  // (clipboard API resolve, hoặc execCommand fallback trả true). Mọi lỗi đều
  // được trả về cho caller xử lý — KHÔNG nuốt lỗi rồi báo thành công giả nữa.
  function copyText(t) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = t; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.left = '0'; ta.style.opacity = '0.01';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        try { ta.setSelectionRange(0, ta.value.length); } catch (e) {}
        var ok = false;
        try { ok = !!document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove();
        return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }
  function doShare(key, link, noteEl) {
    if (!link) {
      setShareNote(noteEl, 'Chưa tạo được link chia sẻ cho binder này. Hãy thử lại sau khi binder tải xong.');
      return Promise.resolve(false);
    }
    function finish(ok, how) {
      if (ok) {
        hideManualLink(noteEl);
        var awarded = awardSharePoint(key);
        setShareNote(noteEl, awarded
          ? (how === 'share'
            ? 'Đã chia sẻ qua hộp thoại chia sẻ (+3 điểm tương tác cho lượt chia sẻ tính điểm). Link binder: ' + link
            : 'Đã copy link binder: ' + link + ' (+3 điểm tương tác cho lượt chia sẻ tính điểm).')
          : 'Đã đạt giới hạn chia sẻ tính điểm trong tuần (' + SHARE_WEEK_CAP + ' lượt / thiết bị / binder) — ' +
            (how === 'share' ? 'đã chia sẻ' : 'đã copy link') + ', nhưng lần chia sẻ này không cộng điểm. Link binder: ' + link);
      }
      renderSocial();
      return ok;
    }
    function copyPath() {
      return copyText(link).then(function (ok) {
        if (!ok) {
          // Không cộng điểm, không báo "đã copy": đưa link ra ô copy tay.
          setShareNote(noteEl, 'Chưa copy tự động được (trình duyệt đã chặn quyền clipboard). Link binder của bạn ở ô ngay bên dưới — hãy tự copy rồi dán vào nơi muốn chia sẻ. Lần này chưa cộng điểm vì chưa xác nhận được việc copy.');
          showManualLink(noteEl, link);
          renderSocial();
          return false;
        }
        return finish(true, 'copy');
      }, function () {
        setShareNote(noteEl, 'Chưa copy tự động được (trình duyệt đã chặn quyền clipboard). Link binder của bạn ở ô ngay bên dưới — hãy tự copy rồi dán vào nơi muốn chia sẻ. Lần này chưa cộng điểm vì chưa xác nhận được việc copy.');
        showManualLink(noteEl, link);
        renderSocial();
        return false;
      });
    }
    // Ưu tiên hộp thoại chia sẻ thật khi trình duyệt có.
    if (typeof navigator.share === 'function') {
      var data = { title: 'Build Your Binder — Bán Card Thui', text: 'Xem binder Pokémon TCG của mình nè!', url: link };
      var can = true;
      try { if (typeof navigator.canShare === 'function') can = navigator.canShare(data); } catch (e) { can = false; }
      if (can) {
        return navigator.share(data).then(function () { return finish(true, 'share'); }, function (err) {
          if (err && err.name === 'AbortError') {
            // Người dùng tự huỷ hộp thoại: KHÔNG cộng điểm, note trung tính.
            hideManualLink(noteEl);
            setShareNote(noteEl, 'Bạn đã đóng hộp thoại chia sẻ trước khi chia sẻ xong — không sao cả, lần này không cộng điểm. Bấm Chia sẻ lại khi bạn sẵn sàng nhé.');
            renderSocial();
            return false;
          }
          // Lỗi khác (bị chặn / không hỗ trợ dữ liệu): lùi về đường copy.
          return copyPath();
        });
      }
    }
    return copyPath();
  }
  // Bọc mọi điểm bấm chia sẻ: tạo link lỗi (buildShareLink ném exception)
  // cũng phải hiện note rõ ràng thay vì "bấm như không có gì xảy ra".
  function tryShare(key, linkOrFn, noteEl) {
    var link;
    try { link = (typeof linkOrFn === 'function') ? linkOrFn() : linkOrFn; }
    catch (e) {
      setShareNote(noteEl, 'Không tạo được link chia sẻ lúc này (' + (e && e.message ? e.message : 'lỗi không rõ') + '). Hãy thử tải lại trang rồi bấm Chia sẻ lại.');
      return Promise.resolve(false);
    }
    return doShare(key, link, noteEl);
  }

  // ---------- leaderboard / cộng đồng / featured / thử thách ----------
  var lbTab = 'value';
  function myPct() {
    if (!cur.cards.length) return 0;
    var v = picksOf(cur.set.id).filter(function (p) { return isVerified(p.st); }).length;
    return Math.round(v / cur.cards.length * 1000) / 10;
  }
  function lbEntries() {
    var list = SAMPLES.map(function (sm) {
      var e = sampleEng(sm);
      return { key: sm.key, owner: sm.owner, value: sm.value, pct: sm.pct, likes: e.likes, points: samplePoints(sm), joined: sm.joined, sample: true, sm: sm };
    });
    var me = myEng();
    list.push({ key: 'me', owner: state.name || 'Bạn', value: myValue(), pct: myPct(), likes: me.likes, points: myPoints(), joined: state.joined, me: true });
    return list;
  }
  function renderSocial() { renderChallenge(); renderLeaderboard(); renderCommunity(); renderFeatured(); }

  function renderChallenge() {
    if (!els.challenge) return;
    var end = sundayEnd();
    var html = '<div class="challenge-theme"><div class="challenge-title">“' + esc(THEME.title) + '”</div>' +
      '<p>' + esc(THEME.desc) + '</p>' +
      '<p class="tray-note">📜 <b>Luật chơi:</b> chủ đề <b>mở</b> — shop chỉ ra chủ đề, bạn <b>tự diễn giải</b> bằng binder của mình, <b>không có danh sách lá bắt buộc</b>. ' +
      'Đăng binder lên cộng đồng + tham gia thử thách, rồi kiếm <b>điểm tương tác</b>: ❤️ tim ×1 · 🔗 chia sẻ ×3 · 👀 lượt xem ×0,2 ' +
      '(chống farm: 1 lượt xem / thiết bị / binder / tuần; điểm lượt xem tối đa ' + VIEW_POINTS_CAP + ' điểm / binder; chia sẻ tính điểm tối đa ' + SHARE_WEEK_CAP + ' lượt / thiết bị / tuần). ' +
      'Chốt điểm: <b>23:59 Chủ nhật tuần này (' + fmtDate(end) + ')</b>. 🎁 Phần thưởng <b>(mẫu)</b>: Binder of the Week được ghim featured trên store + quà của shop; thêm giải ⭐ Shop chọn do shop chấm riêng.</p></div>';
    if (state.joined) {
      var e = myEng();
      html += '<div class="challenge-join done">✅ Binder của bạn <b>đang tham gia</b> thử thách tuần này · Điểm tương tác: <b>' + myPoints() + ' điểm</b> ' +
        '(❤️ ' + e.wkLikes + ' · 🔗 ' + e.wkShares + ' · 👀 ' + e.wkViews + ')<br>' +
        '<button type="button" class="mini-btn" id="ch-leave">Rút khỏi thử thách</button></div>';
    } else {
      html += '<div class="challenge-join"><button type="button" class="co-btn inline" id="ch-join">🏆 Tham gia thử thách tuần</button>' +
        '<p class="tray-note">Điều kiện: binder phải đã đăng công khai lên Binder cộng đồng — bấm tham gia sẽ tự bật đăng công khai nếu bạn chưa đăng.</p></div>';
    }
    var insp = themeCards();
    if (insp.length) {
      html += '<div class="inspire"><h4>💡 Gợi ý cảm hứng theo chủ đề (tuỳ chọn — không gắn điểm số / tiến độ)</h4><div class="inspire-grid" id="inspire-grid"></div></div>';
    }
    els.challenge.innerHTML = html;
    var join = $('ch-join');
    if (join) join.addEventListener('click', function () {
      if (!state.published) { state.published = true; els.publishNote.hidden = false; els.publishNote.textContent = 'Đã tự bật đăng công khai lên Binder cộng đồng để bạn tham gia thử thách.'; }
      state.joined = true; saveState(); render();
    });
    var leave = $('ch-leave');
    if (leave) leave.addEventListener('click', function () { state.joined = false; saveState(); render(); });
    var grid = $('inspire-grid');
    if (grid) insp.forEach(function (card) { grid.appendChild(sugRow(card, 'Cảm hứng: ' + THEME.title)); });
  }

  function renderLeaderboard() {
    if (!els.lbBody) return;
    var entries = lbEntries();
    var rows = entries.slice();
    var title = '';
    if (lbTab === 'value') { rows.sort(function (a, b) { return b.value - a.value; }); title = 'Xếp theo 💎 giá trị lá THẬT (Cardmarket trend) — mơ ước không tính'; }
    if (lbTab === 'setpct') { rows.sort(function (a, b) { return b.pct - a.pct; }); title = 'Xếp theo 📚 % lá thật / tổng lá của set chính'; }
    if (lbTab === 'likes') { rows.sort(function (a, b) { return b.likes - a.likes; }); title = 'Xếp theo ❤️ tổng số tim'; }
    if (lbTab === 'challenge') { rows = rows.filter(function (r) { return r.joined; }); rows.sort(function (a, b) { return b.points - a.points; }); title = 'Xếp theo 🏆 điểm tương tác tuần này (❤️ ×1 · 🔗 ×3 · 👀 ×0,2) — chỉ binder đã tham gia'; }
    var html = '<p class="tray-note">' + esc(title) + '</p><ol class="lb-list">';
    rows.forEach(function (r, i) {
      var metric = lbTab === 'value' ? fmt(r.value) : lbTab === 'setpct' ? r.pct + '%' : lbTab === 'likes' ? '❤️ ' + r.likes : r.points + ' điểm';
      var tag = '';
      if (lbTab === 'challenge' && i === 0) tag = ' <span class="botw-tag">Binder of the Week (mẫu)</span>';
      if (r.sm && r.sm.shopPick) tag += ' <span class="shop-pick-tag">⭐ Shop chọn</span>';
      html += '<li class="lb-row' + (r.me ? ' me' : '') + '"><span class="lb-rank">' + (i + 1) + '</span>' +
        '<span class="lb-owner">' + esc(r.owner) + (r.me ? ' (bạn)' : '') + (r.sample ? ' <span class="sample-tag">MẪU</span>' : '') + tag + '</span>' +
        '<b class="lb-metric">' + metric + '</b></li>';
    });
    html += '</ol>';
    els.lbBody.innerHTML = html;
  }

  function sampleCards(sm) {
    var cards = cache[sm.setId] || [];
    var byName = {};
    cards.forEach(function (c) { byName[c.name] = c; });
    return sm.names.map(function (n) { return byName[n]; }).filter(Boolean);
  }
  function binderCardEl(owner, cards, meta, opts) {
    opts = opts || {};
    var el = document.createElement('div'); el.className = 'comm-card';
    var head = document.createElement('div'); head.className = 'comm-head';
    head.innerHTML = '<b>' + esc(owner) + '</b>' + (opts.sample ? ' <span class="sample-tag">MẪU</span>' : '') +
      (opts.shopPick ? ' <span class="shop-pick-tag">⭐ Shop chọn</span>' : '');
    el.appendChild(head);
    var grid = document.createElement('div'); grid.className = 'comm-grid';
    cards.slice(0, 6).forEach(function (c) {
      var img = document.createElement('img'); img.src = (c.img || c.image || '') + '/low.webp'; img.alt = c.name || ''; img.loading = 'lazy';
      grid.appendChild(img);
    });
    if (!cards.length) grid.innerHTML = '<span class="tray-note">Đang tải lá xem trước…</span>';
    el.appendChild(grid);
    var info = document.createElement('p'); info.className = 'comm-info'; info.textContent = meta;
    el.appendChild(info);
    var acts = document.createElement('div'); acts.className = 'comm-acts';
    var view = document.createElement('button'); view.type = 'button'; view.className = 'mini-btn';
    view.textContent = '👀 Xem binder';
    view.addEventListener('click', opts.onView);
    acts.appendChild(view);
    var like = document.createElement('button'); like.type = 'button'; like.className = 'mini-btn';
    like.textContent = '❤️ ' + opts.likes;
    like.disabled = !!opts.likeDisabled;
    like.addEventListener('click', opts.onLike);
    acts.appendChild(like);
    var share = document.createElement('button'); share.type = 'button'; share.className = 'mini-btn';
    share.textContent = '🔗 Chia sẻ';
    share.addEventListener('click', opts.onShare);
    acts.appendChild(share);
    el.appendChild(acts);
    return el;
  }
  function renderCommunity() {
    if (!els.community) return;
    els.community.innerHTML = '';
    SAMPLES.forEach(function (sm) {
      var e = sampleEng(sm);
      var meta = '💎 ' + fmt(sm.value) + ' (mẫu) · ✓ ' + sm.verified + ' lá thật · 📚 ' + sm.pct + '% · ❤️ ' + e.likes + ' tim' +
        (sm.joined ? ' · 🏆 Điểm tương tác tuần: ' + samplePoints(sm) + ' (❤️ ' + e.wkLikes + ' · 🔗 ' + e.wkShares + ' · 👀 ' + e.wkViews + ' — số mẫu)' : ' · Chưa tham gia thử thách tuần');
      var el = binderCardEl(sm.owner, sampleCards(sm), meta, {
        sample: true, shopPick: sm.shopPick, likes: e.likes,
        onView: function () { openSampleView(sm); },
        onLike: function () { var m = doLike(sm.key, false); els.publishNote.hidden = false; els.publishNote.textContent = m; },
        onShare: function () { els.publishNote.hidden = false; tryShare(sm.key, function () { return location.origin + location.pathname + '#mau=' + sm.key; }, els.publishNote); }
      });
      els.community.appendChild(el);
    });
    if (state.published) {
      var me = myEng();
      var picks = allPicks();
      var cards = picks.map(function (p) { return { img: p.img, name: p.name }; });
      var meta2 = '💎 ' + fmt(myValue()) + ' · ✓ ' + picks.filter(function (p) { return isVerified(p.st); }).length + ' lá thật · ○ ' + picks.filter(function (p) { return p.st === 'dream'; }).length + ' mơ ước · 📚 ' + myPct() + '% · ❤️ ' + me.likes + ' tim' +
        (state.joined ? ' · 🏆 Điểm tương tác tuần: ' + myPoints() + ' (❤️ ' + me.wkLikes + ' · 🔗 ' + me.wkShares + ' · 👀 ' + me.wkViews + ')' : ' · Chưa tham gia thử thách tuần');
      var el2 = binderCardEl(state.name || 'Bạn', cards, meta2, {
        likes: me.likes, likeDisabled: true,
        onView: function () { openView({ key: 'me', owner: state.name || 'Bạn', cards: picks, isSelf: true }); },
        onLike: function () {},
        onShare: function () { els.publishNote.hidden = false; tryShare('me', buildShareLink, els.publishNote); }
      });
      el2.classList.add('mine');
      els.community.appendChild(el2);
    }
  }
  function renderFeatured() {
    if (!els.featured) return;
    var joined = SAMPLES.filter(function (s) { return s.joined; });
    var botw = joined.slice().sort(function (a, b) { return samplePoints(b) - samplePoints(a); })[0];
    var pick = SAMPLES.filter(function (s) { return s.shopPick; })[0];
    els.featured.innerHTML = '';
    if (botw) {
      var e1 = sampleEng(botw);
      var c1 = binderCardEl('🏆 Binder of the Week (mẫu) — ' + botw.owner, sampleCards(botw),
        'Điểm tương tác cao nhất tuần (mẫu): ' + samplePoints(botw) + ' điểm · 💎 ' + fmt(botw.value) + ' (mẫu) · ❤️ ' + e1.likes,
        { sample: true, likes: e1.likes, onView: function () { openSampleView(botw); }, onLike: function () { doLike(botw.key, false); }, onShare: function () { els.publishNote.hidden = false; tryShare(botw.key, function () { return location.origin + location.pathname + '#mau=' + botw.key; }, els.publishNote); } });
      els.featured.appendChild(c1);
    }
    if (pick) {
      var e2 = sampleEng(pick);
      var c2 = binderCardEl('⭐ Shop chọn — ' + pick.owner, sampleCards(pick),
        'Shop chấm vì sáng tạo / đúng vibe chủ đề “' + THEME.title + '” (mẫu) · 💎 ' + fmt(pick.value) + ' (mẫu) · ❤️ ' + e2.likes,
        { sample: true, shopPick: true, likes: e2.likes, onView: function () { openSampleView(pick); }, onLike: function () { doLike(pick.key, false); }, onShare: function () { els.publishNote.hidden = false; tryShare(pick.key, function () { return location.origin + location.pathname + '#mau=' + pick.key; }, els.publishNote); } });
      els.featured.appendChild(c2);
    }
  }

  // ---------- chế độ chỉ-xem (chia sẻ + cộng đồng) ----------
  var viewCtx = null;
  function sharedPriceEl(c) {
    var box = document.createElement('div'); box.className = 'p-foot shared-price';
    box.setAttribute('data-price-for', c.id || '');
    var t = displayPriceText(c.id);
    var a = document.createElement('span'); a.className = 'p-price'; a.textContent = t.text;
    var b = document.createElement('span'); b.className = 'p-qty p-price-label'; b.textContent = t.label;
    box.appendChild(a); box.appendChild(b);
    return box;
  }
  function updateSharedPrices() {
    if (!viewCtx || els.sharedView.hidden) return;
    var nodes = els.sharedBody.querySelectorAll('[data-price-for]');
    Array.prototype.forEach.call(nodes, function (n) {
      var id = n.getAttribute('data-price-for');
      if (!id) return;
      var t = displayPriceText(id);
      var spans = n.querySelectorAll('span');
      if (spans[0]) spans[0].textContent = t.text;
      if (spans[1]) spans[1].textContent = t.label;
    });
    var tot = els.sharedBody.querySelector('.shared-total-val');
    var note = els.sharedBody.querySelector('.shared-total-note');
    if (tot) {
      var dt = displayTotal(viewCtx.cards || []);
      tot.textContent = fmt(dt.total);
      if (note) note.textContent = dt.unpriced
        ? ('Đã tính ' + dt.priced + '/' + (viewCtx.cards || []).length + ' lá — ' + dt.unpriced + ' lá chưa có giá nào nên chưa tính vào tổng.')
        : ('Đã tính đủ ' + dt.priced + ' lá.');
    }
  }
  function openView(ctx) {
    viewCtx = ctx;
    var viewCapped = wkViewsOf(ctx.key) * 0.2 >= VIEW_POINTS_CAP;
    var counted = countView(ctx.key, !!ctx.isSelf);
    els.sharedView.hidden = false;
    els.sharedTitle.textContent = '🔗 Binder của ' + ctx.owner + ' — chỉ xem';
    els.sharedBody.innerHTML = '';
    (ctx.cards || []).forEach(function (c) { if (c.id && c.setId) ensurePrice({ id: c.id, setId: c.setId }); });
    var dt0 = displayTotal(ctx.cards || []);
    var totBox = document.createElement('div'); totBox.className = 'shared-total binder-total';
    totBox.innerHTML = '<span class="bt-label">' + TOTAL_LABEL + '</span>' +
      '<b class="shared-total-val binder-total-val">' + fmt(dt0.total) + '</b>' +
      '<span class="shared-total-note binder-total-note">' + (dt0.unpriced
        ? ('Đã tính ' + dt0.priced + '/' + (ctx.cards || []).length + ' lá — ' + dt0.unpriced + ' lá chưa có giá nào nên chưa tính vào tổng.')
        : ('Đã tính đủ ' + dt0.priced + ' lá.')) + '</span>';
    els.sharedBody.appendChild(totBox);
    var grid = document.createElement('div'); grid.className = 'pockets shared-grid';
    (ctx.cards || []).forEach(function (c) {
      var d = document.createElement('div'); d.className = 'pocket';
      var w = document.createElement('div'); w.className = 'p-imgwrap';
      var img = document.createElement('img'); img.src = (c.img || '') + '/low.webp'; img.alt = c.name || ''; img.loading = 'lazy';
      w.appendChild(img); d.appendChild(w);
      var nm = document.createElement('div'); nm.className = 'p-name';
      nm.textContent = (c.localId ? '#' + c.localId + ' · ' : '') + (c.name || '');
      d.appendChild(nm);
      d.appendChild(sharedPriceEl(c));
      if (c.st) {
        var b = document.createElement('span'); b.className = 'p-badge st-' + c.st; b.textContent = ST_LABEL[c.st] || c.st;
        d.appendChild(b);
      }
      grid.appendChild(d);
    });
    if (!ctx.cards || !ctx.cards.length) grid.innerHTML = '<p class="tray-note">Binder này chưa có lá nào (hoặc lá chưa tải xong).</p>';
    els.sharedBody.appendChild(grid);
    els.sharedNote.textContent = (counted && viewCapped ? '👀 Đã tính 1 lượt xem cho binder này, nhưng binder đã đạt trần điểm lượt xem (' + VIEW_POINTS_CAP + ' điểm) — lần này không cộng thêm điểm. ' : counted ? '👀 Đã tính 1 lượt xem cho binder này (+0,2 điểm, tối đa 1 lượt / thiết bị / tuần). ' : '') +
      (ctx.isSelf ? 'Đây là binder của chính bạn trên thiết bị này — không tự thả tim / tính lượt xem được.' : 'Thả tim ❤️ +1 điểm · Chia sẻ 🔗 +3 điểm cho binder này.');
    els.sharedLike.disabled = !!ctx.isSelf;
    els.sharedView.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function openSampleView(sm) {
    openView({
      key: sm.key, owner: sm.owner + ' (binder mẫu)',
      cards: sampleCards(sm).map(function (c) { return { id: c.id, setId: c.setId, img: c.img, name: c.name, localId: c.localId, st: 'verified-buy' }; }),
      isSelf: false
    });
  }
  els.sharedLike.addEventListener('click', function () {
    if (!viewCtx) return;
    els.sharedNote.textContent = doLike(viewCtx.key, !!viewCtx.isSelf);
    renderSocial();
  });
  els.sharedShare.addEventListener('click', function () {
    if (!viewCtx) return;
    var ctx = viewCtx;
    tryShare(ctx.key, function () {
      if (ctx.key === 'me') return buildShareLink();
      // Binder mở từ link #b= (key 'shr-…'): chia sẻ lại chính URL #b= hiện tại.
      // Trước đây nhánh này luôn ghép '#mau=' + key → link '#mau=shr-…' mà đầu
      // nhận không hiểu (#mau chỉ nhận s1..s5) nên người nhận mở ra không thấy gì.
      if (ctx.key.indexOf('shr-') === 0) return location.href;
      return location.origin + location.pathname + '#mau=' + ctx.key;
    }, els.sharedNote);
  });
  els.sharedMine.addEventListener('click', function () {
    els.sharedView.hidden = true;
    history.replaceState(null, '', location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---------- chia sẻ link ----------
  function buildShareLink() {
    var payload = {
      u: state.uid, n: state.name || 'Bạn',
      c: allPicks().map(function (p) { return [p.setId, p.id, p.st]; })
    };
    var enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname + '#b=' + enc;
  }
  function parseShared() {
    var m = /#b=([A-Za-z0-9\-_]+)/.exec(location.hash || '');
    if (!m) return null;
    try {
      var json = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))));
      return JSON.parse(json);
    } catch (e) { return null; }
  }
  function openSharedLink(data) {
    var needSets = {};
    (data.c || []).forEach(function (row) { needSets[row[0]] = 1; });
    var defs = SETS.filter(function (s) { return needSets[s.id]; });
    Promise.all(defs.map(function (d) { return fetchSetData(d).catch(function () {}); })).then(function () {
      var cards = (data.c || []).map(function (row) {
        var card = cardReg[row[1]];
        return card ? { id: card.id, setId: card.setId, img: card.img, name: card.name, localId: card.localId, st: row[2] } : null;
      }).filter(Boolean);
      openView({ key: 'shr-' + data.u, owner: data.n || 'một người bạn', cards: cards, isSelf: data.u === state.uid });
    });
  }

  // ---------- xuất ảnh ----------
  els.exportBtn.addEventListener('click', function () {
    var slice = cur.cards.slice(cur.page * PAGE_SIZE, cur.page * PAGE_SIZE + PAGE_SIZE);
    if (!slice.length) { els.exportNote.hidden = false; els.exportNote.textContent = 'Chưa có lá nào để xuất ảnh.'; return; }
    els.exportNote.hidden = false; els.exportNote.textContent = 'Đang dựng ảnh trang binder…';
    var W = 900, H = 1080, cellW = W / 3, cellH = (H - 70) / 3;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#f7f5ea'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#20394d'; ctx.font = '700 34px sans-serif';
    ctx.fillText('Bán Card Thui — Build Your Binder', 24, 46);
    var jobs = slice.map(function (card, i) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
          var x = (i % 3) * cellW + 14, y = 70 + Math.floor(i / 3) * cellH + 10;
          ctx.drawImage(img, x, y, cellW - 28, cellH - 44);
          ctx.fillStyle = '#20394d'; ctx.font = '600 19px sans-serif';
          ctx.fillText(('#' + card.localId + ' ' + card.name).slice(0, 30), x, y + cellH - 14);
          resolve(true);
        };
        img.onerror = function () { resolve(false); };
        img.src = card.img + '/high.webp';
      });
    });
    Promise.all(jobs).then(function () {
      ctx.fillStyle = '#b13a48'; ctx.font = '700 22px sans-serif';
      ctx.fillText('© Bán Card Thui · binder.html', 24, H - 14);
      try {
        cv.toBlob(function (blob) {
          if (!blob) throw new Error('no blob');
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'binder-trang-' + (cur.page + 1) + '.png';
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          els.exportNote.textContent = 'Đã xuất ảnh trang binder (có watermark “Bán Card Thui”).';
        }, 'image/png');
      } catch (e) {
        els.exportNote.textContent = 'Không xuất được ảnh: trình duyệt chặn đọc ảnh TCGdex qua canvas (CORS). Bạn vẫn chia sẻ được bằng link binder ở trên.';
      }
    });
  });

  // ---------- quét xác thực: OCR thật trên máy + mô phỏng dự phòng ----------
  var scanTarget = null; // pick cần lên đời; null = quét chung (lá nào khớp, lá đó lên đời / thêm mới)
  var dictIndex = null, tessPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script'); sc.src = src;
      sc.onload = resolve; sc.onerror = reject;
      document.head.appendChild(sc);
    });
  }
  function ensureDict() {
    if (dictIndex) return Promise.resolve(dictIndex);
    var build = function () { dictIndex = window.BCTMatch.buildIndex(window.BCT_DICT); return dictIndex; };
    if (window.BCT_DICT) return Promise.resolve(build());
    return loadScript('js/cards-dict.js?v=20261030-ocr3').then(build);
  }
  function ensureTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tessPromise) tessPromise = loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js').then(function () { return window.Tesseract; });
    return tessPromise;
  }
  function openScan(pick) {
    scanTarget = pick || null;
    els.scanPanel.hidden = false;
    els.scanSim.hidden = true;
    els.scanCands.innerHTML = '';
    els.scanOcr.hidden = true;
    els.scanStatus.textContent = pick
      ? 'Quét lá “' + pick.name + '”: chụp / chọn ảnh lá thật của bạn. OCR khớp đúng lá này thì lá lên đời ✓ Đã xác thực (quét).'
      : 'Quét chung: chụp / chọn ảnh 1 lá thật — khớp được lá mơ ước nào, lá đó lên đời ✓ Đã xác thực (quét).';
    els.scanFile.value = '';
    els.scanFile.click();
  }
  function scanSetStatus(t) { els.scanStatus.textContent = t; }
  function upgradeByScan(card, evDataUrl, simulated) {
    var pick = findPick(card.setId, card.id) || addPick(card, 'verified-scan');
    pick.st = 'verified-scan';
    if (simulated) pick.sim = true; else delete pick.sim;
    if (evDataUrl) { try { pick.ev = evDataUrl; } catch (e) {} }
    saveState(); ensurePrice(pick);
    scanSetStatus('✅ Đã lên đời: “' + card.name + '” → ✓ Đã xác thực (' + (simulated ? 'quét mô phỏng — bản thử' : 'quét OCR thật') + ').');
    render();
  }
  function downscaleEvidence(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var cv = document.createElement('canvas');
          var scale = Math.min(1, 240 / img.width);
          cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.6));
        } catch (e) { resolve(null); }
        URL.revokeObjectURL(url);
      };
      img.onerror = function () { resolve(null); URL.revokeObjectURL(url); };
      img.src = url;
    });
  }
  // Crop + tiền xử lý Y HỆT pipeline OCR của app kho (js/app.js ocrCropCanvas):
  // phóng 2x + xám hoá + tăng tương phản (gray-128)*1.25+128.
  function cropCanvas(img, fx0, fy0, fx1, fy1) {
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    var sx = Math.max(0, Math.floor(W * fx0)), sy = Math.max(0, Math.floor(H * fy0));
    var sw = Math.max(1, Math.floor(W * (fx1 - fx0))), sh = Math.max(1, Math.floor(H * (fy1 - fy0)));
    var cv = document.createElement('canvas');
    cv.width = sw * 2; cv.height = sh * 2;
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    try {
      var data = ctx.getImageData(0, 0, cv.width, cv.height), px = data.data;
      for (var i = 0; i < px.length; i += 4) {
        var gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        var v = (gray - 128) * 1.25 + 128;
        v = v < 0 ? 0 : (v > 255 ? 255 : v);
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
    } catch (e) { /* tiền xử lý hỏng thì OCR trên ảnh crop gốc */ }
    return cv;
  }
  function matchCandidateToCard(cand) {
    if (!window.BCTMatch) return null;
    var nameKey = window.BCTMatch.normName(cand.name || '');
    var numKey = window.BCTMatch.numKey(cand.number || '');
    var ocrTokens = {};
    // Tên OCR hay dính rác ("£5 Poliwrath (I,") — so theo TOKEN: mọi token của
    // tên ứng viên đều nằm trong token OCR (hoặc ngược lại) thì coi là khớp tên.
    String(cand._ocrName || '').split(' ').forEach(function (t) { if (t) ocrTokens[t] = 1; });
    var best = null, bestScore = -1;
    Object.keys(cardReg).forEach(function (id) {
      var c = cardReg[id];
      var nk = window.BCTMatch.normName(c.name);
      var ck = window.BCTMatch.numKey(c.localId);
      var score = -1;
      if (nk === nameKey && (!numKey || ck === numKey)) score = 100;
      else if (numKey && ck === numKey && nk === nameKey) score = 95;
      else {
        var toks = nk.split(' ').filter(Boolean);
        var allIn = toks.length > 0 && toks.every(function (t) { return ocrTokens[t]; });
        if (allIn && (!numKey || ck === numKey)) score = 80;
        else if (allIn) score = 60;
        else if (numKey && ck === numKey) score = 40;
      }
      if (score > bestScore) { bestScore = score; best = score >= 40 ? c : best; }
    });
    return bestScore >= 40 ? best : null;
  }
  function runOcr(file) {
    els.scanSim.hidden = false; // luôn có đường mô phỏng sau khi đã thử OCR
    scanSetStatus('Đang nạp OCR + từ điển lá (lần đầu hơi lâu)…');
    var evPromise = downscaleEvidence(file);
    Promise.all([ensureTesseract(), ensureDict()])
      .then(function () {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          var isJp = cur.set.lang === 'ja';
          scanSetStatus('Đang OCR vùng tên lá…');
          window.Tesseract.recognize(cropCanvas(img, 0.04, 0.02, 0.75, 0.13), isJp ? 'jpn+eng' : 'eng')
            .then(function (r1) {
              var nameRaw = (r1 && r1.data && r1.data.text) || '';
              var firstLine = nameRaw.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean)[0] || nameRaw.trim();
              scanSetStatus('Đang OCR vùng số in…');
              return window.Tesseract.recognize(cropCanvas(img, 0, 0.88, 0.30, 1.0), 'eng', { tessedit_char_whitelist: '0123456789/' })
                .then(function (r2) { return { name: firstLine, number: (r2 && r2.data && r2.data.text) || '' }; });
            })
            .then(function (res) {
              URL.revokeObjectURL(url);
              var numberText = window.BCTMatch.fixNumber(res.number) || '';
              els.scanOcr.hidden = false;
              els.scanOcr.textContent = 'OCR đọc được — tên: ' + (res.name || '—') + ' · số: ' + (numberText || '—');
              var cands = window.BCTMatch.searchDict(dictIndex, { name: res.name, number: numberText }, { limit: 6 }) || [];
              if (!cands.length && numberText) cands = window.BCTMatch.searchDict(dictIndex, { number: numberText }, { limit: 6 }) || [];
              if (!cands.length && res.name) cands = window.BCTMatch.searchDict(dictIndex, { name: res.name }, { limit: 6 }) || [];
              var ocrKey = window.BCTMatch.normName(res.name || '');
              cands.forEach(function (c) { c._ocrName = ocrKey; });
              renderScanCandidates(cands, evPromise);
            })
            .catch(function (e) { scanSetStatus('OCR lỗi: ' + (e.message || e) + ' — bạn có thể dùng quét mô phỏng bên dưới (ghi rõ là mô phỏng).'); });
        };
        img.onerror = function () { scanSetStatus('Không đọc được file ảnh. Thử ảnh khác, hoặc dùng quét mô phỏng.'); };
        img.src = url;
      })
      .catch(function () { scanSetStatus('Không nạp được thư viện OCR / từ điển (kiểm tra mạng). Bạn có thể dùng quét mô phỏng bên dưới (ghi rõ là mô phỏng).'); });
  }
  function renderScanCandidates(cands, evPromise) {
    els.scanCands.innerHTML = '';
    var mapped = [];
    cands.forEach(function (cand) {
      var card = matchCandidateToCard(cand);
      if (card && mapped.indexOf(card) < 0) mapped.push(card);
    });
    if (scanTarget) {
      var targetCard = cardReg[scanTarget.id];
      if (targetCard && mapped.indexOf(targetCard) >= 0) {
        evPromise.then(function (ev) { upgradeByScan(targetCard, ev, false); });
        return;
      }
      scanSetStatus('OCR chưa khớp đúng lá “' + scanTarget.name + '”. Chọn lá đúng trong các ứng viên dưới đây nếu có, hoặc thử ảnh rõ hơn / dùng quét mô phỏng.');
    } else if (!mapped.length) {
      scanSetStatus('OCR không khớp được lá nào trong 4 set của binder. Thử ảnh rõ hơn / đúng chiều, hoặc dùng quét mô phỏng.');
      return;
    } else {
      scanSetStatus('OCR khớp được ' + mapped.length + ' lá — bấm lá đúng để lên đời:');
    }
    mapped.forEach(function (card) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'mini-btn scan-cand';
      b.textContent = '✓ ' + card.name + ' (#' + card.localId + ')';
      b.addEventListener('click', function () { evPromise.then(function (ev) { upgradeByScan(card, ev, false); }); });
      els.scanCands.appendChild(b);
    });
  }
  els.scanFile.addEventListener('change', function () {
    var f = els.scanFile.files && els.scanFile.files[0];
    if (f) runOcr(f);
  });
  els.scanSim.addEventListener('click', function () {
    var target = scanTarget;
    if (!target) {
      var dreams = allPicks().filter(function (p) { return p.st === 'dream'; });
      target = dreams.length ? dreams[Math.floor(Math.random() * dreams.length)] : null;
    }
    if (!target) { scanSetStatus('Chưa có lá mơ ước nào để quét mô phỏng. Thêm lá mơ ước trước đã.'); return; }
    var card = cardReg[target.id];
    if (card) upgradeByScan(card, null, true);
    else { target.st = 'verified-scan'; target.sim = true; saveState(); render(); scanSetStatus('✅ Đã lên đời (quét mô phỏng — bản thử): “' + target.name + '”.'); }
  });
  els.scanClose.addEventListener('click', function () { els.scanPanel.hidden = true; });
  els.scanAny.addEventListener('click', function () { openScan(null); });

  // ---------- sự kiện chung ----------
  els.prev.addEventListener('click', function () { if (cur.page > 0) { cur.page--; renderPockets(); } });
  els.next.addEventListener('click', function () { if (cur.page < pageCount() - 1) { cur.page++; renderPockets(); } });
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
    state.picks[cur.set.id] = [];
    saveState(); render();
  });
  els.name.addEventListener('input', function () {
    state.name = els.name.value.trim().slice(0, 24);
    saveState(); renderSocial();
  });
  els.shareBtn.addEventListener('click', function () {
    tryShare('me', buildShareLink, els.shareNote);
  });
  els.publishBtn.addEventListener('click', function () {
    state.published = !state.published;
    if (!state.published && state.joined) { /* giữ joined nhưng không hiện gallery: LB thử thách vẫn tính */ }
    saveState();
    els.publishNote.hidden = false;
    els.publishNote.textContent = state.published
      ? 'Đã đăng binder của bạn lên Binder cộng đồng (hiện ở cuối gallery, trên thiết bị này).'
      : 'Đã rút binder khỏi Binder cộng đồng.';
    render();
  });
  Array.prototype.forEach.call(document.querySelectorAll('.lb-tab'), function (tab) {
    tab.addEventListener('click', function () {
      lbTab = tab.getAttribute('data-lb');
      Array.prototype.forEach.call(document.querySelectorAll('.lb-tab'), function (t) { t.classList.toggle('active', t === tab); });
      renderLeaderboard();
    });
  });

  // ---------- khởi tạo ----------
  SETS.forEach(function (s) {
    var o = document.createElement('option'); o.value = s.id; o.textContent = s.label;
    els.select.appendChild(o);
  });
  els.name.value = state.name || '';
  allPicks().forEach(function (p) { ensurePrice(p); });
  loadSet(SETS[0]);
  // Nạp nền các set còn lại để gallery cộng đồng + khay đa set có dữ liệu.
  SETS.slice(1).forEach(function (s) { fetchSetData(s).catch(function () {}); });
  var shared = parseShared();
  if (shared) openSharedLink(shared);
  var mau = /#mau=(s\d)/.exec(location.hash || '');
  if (mau) {
    var sm = SAMPLES.filter(function (x) { return x.key === mau[1]; })[0];
    if (sm) setTimeout(function () { openSampleView(sm); }, 600);
  }
  renderSocial();
})();
