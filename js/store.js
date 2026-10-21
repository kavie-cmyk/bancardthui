/* Bán Card Thui — store.js (Supabase backend)
 * Lớp dữ liệu bất đồng bộ qua Supabase PostgREST/Storage (js/db.js).
 * State in-memory giữ nguyên shape camelCase như bản localStorage cũ nên
 * các hàm tính toán thuần túy (FIFO plan, lãi/lỗ, tiến độ set...) không đổi.
 *
 * Quy ước: hàm đọc/tính toán = sync; hàm ghi DB = async (ghi xuyên suốt +
 * cập nhật state in-memory). Ảnh: ưu tiên ảnh user upload (card_images) →
 * ảnh chính thức TCGdex CDN → placeholder.
 */
(function (root) {
  'use strict';
  var SB = root.SB;

  // ---------- utils ----------
  function firstNonNull() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] != null) return arguments[i];
    }
    return null;
  }

  function fmtVND(n) {
    n = Math.round(Number(n) || 0);
    return n.toLocaleString('vi-VN') + '₫';
  }

  // Rút gọn cho chỗ chật (vd dòng giá trong Kho): 187452 → "187k₫", 1500000 → "1.5tr₫"
  function fmtVNDShort(n) {
    n = Math.round(Number(n) || 0);
    if (n >= 1000000) return (n / 1000000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'tr₫';
    if (n >= 1000) return Math.round(n / 1000) + 'k₫';
    return n + '₫';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return '—';
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + '/' + d.getFullYear();
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var CHANNELS = {
    ebay: 'eBay',
    shopee: 'Shopee',
    facebook: 'Facebook',
    tructiep: 'Trực tiếp'
  };

  var CONDITIONS = ['New Mint', 'A', 'B', 'C', 'D'];

  // Map condition cũ (NM/LP/MP) sang thang mới để hiển thị. Dữ liệu mới đã dùng thang mới.
  var CONDITION_OLD_MAP = { NM: 'A', LP: 'C', MP: 'D' };
  function condLabel(v) {
    if (v == null || v === '') return '—';
    return CONDITION_OLD_MAP[v] || v;
  }

  var LANGUAGES = { en: 'English', jp: 'Japanese', other: 'Khác' };

  // 10 độ hiếm chuẩn dùng trong app (khớp rarity mới của Pokémon TCG)
  var RARITIES = ['Common', 'Uncommon', 'Rare', 'Double Rare', 'Ultra Rare',
    'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'ACE SPEC Rare', 'Promo'];
  var RAREST = ['Hyper Rare', 'Special Illustration Rare'];

  // Phiên bản in của từng lô (finish)
  var VARIANTS = ['Normal', 'Reverse Holo', 'Holo', '1st Edition'];

  // Mẫu holo chi tiết (dân sưu tầm) — nullable, mặc định không ghi nhận
  var HOLO_PATTERNS = ['Cosmos', 'Cosmos Swirl', 'Poké Ball', 'Master Ball', 'Mirror', 'Cracked Ice', 'Confetti', 'Khác'];

  // TCGdex CDN dùng 'ja' cho tiếng Nhật (không phải 'jp')
  var CDN_LANG = { en: 'en', jp: 'ja', other: 'en' };

  // ---------- ảnh ----------
  function setsDB() {
    var g = (typeof window !== 'undefined') ? window
      : ((typeof globalThis !== 'undefined') ? globalThis : null);
    return (g && g.BCT_SETS) ? g.BCT_SETS : null;
  }

  // Trích số thứ tự từ chuỗi collector number ("006"→6, "SWSH230"→230, "006/165"→6)
  function parseCardNumber(num) {
    var m = String(num == null ? '' : num).match(/\d+/);
    if (!m) return null;
    var n = parseInt(m[0], 10);
    return n > 0 ? n : null;
  }

  // Các URL ảnh TCGdex CDN ứng viên (primary + fallback bỏ pad số 0).
  // Trả về mảng rỗng nếu không đủ thông tin.
  function tcgdexURLs(card, quality) {
    quality = quality === 'high' ? 'high' : 'low';
    var num = String(card.number == null ? '' : card.number).trim();
    if (!num || !card.setId) return [];
    var lang = 'en', serie = null;
    if ((card.language || 'en') === 'jp') {
      var db = setsDB();
      serie = db && db.jaSerie ? db.jaSerie(card.setId) : null;
      if (serie) lang = CDN_LANG.jp; // 'ja'
    }
    if (!serie) {
      var db2 = setsDB();
      var s = db2 ? db2.byId(card.setId) : null;
      if (s && s.serie) { serie = s.serie; lang = 'en'; }
    }
    if (!serie) return [];
    var base = 'https://assets.tcgdex.net/' + lang + '/' + serie + '/' + card.setId + '/';
    var urls = [base + encodeURIComponent(num) + '/' + quality + '.png'];
    var n = parseCardNumber(num);
    if (n != null && String(n) !== num) urls.push(base + n + '/' + quality + '.png');
    return urls;
  }

  // URL ảnh chính của card: ảnh upload trước → TCGdex CDN → null (dùng placeholder)
  function cardImageURL(card, quality) {
    if (card.images && card.images.length) return card.images[0];
    var u = tcgdexURLs(card, quality);
    return u.length ? u[0] : null;
  }

  function cardImageFallbackURL(card, quality) {
    if (card.images && card.images.length) return null;
    var u = tcgdexURLs(card, quality);
    return u.length > 1 ? u[1] : null;
  }

  // Placeholder SVG chung khi không có ảnh nào
  function placeholderImage() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">' +
      '<rect width="300" height="420" rx="18" fill="#1a1b21"/>' +
      '<rect x="14" y="14" width="272" height="392" rx="12" fill="none" stroke="rgba(245,214,123,.35)" stroke-width="2"/>' +
      '<circle cx="150" cy="170" r="52" fill="none" stroke="rgba(245,214,123,.5)" stroke-width="2.5"/>' +
      '<text x="150" y="280" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#8a8578">CHƯA CÓ ẢNH</text>' +
      '<text x="150" y="308" text-anchor="middle" font-family="sans-serif" font-size="12" letter-spacing="3" fill="rgba(242,237,226,.4)">POKÉMON TCG</text></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // ---------- mapping DB <-> state ----------
  function mapCard(r, images) {
    return {
      id: r.id, name: r.name, set: r.set || '', setId: r.set_id || null,
      number: r.number || '', rarity: r.rarity || '',
      condition: r.condition || 'A',
      graded: r.graded_org ? { org: r.graded_org, score: r.graded_score || '' } : null,
      language: r.language || 'en',
      images: images || [],
      storageLocation: r.storage_location || '',
      misprint: !!r.misprint,
      certNumber: r.cert_number || '',
      certPop: r.cert_pop != null ? r.cert_pop : null,
      priceSources: Array.isArray(r.price_sources) ? r.price_sources : null,
      marketPrice: r.market_price != null ? Number(r.market_price) : null, // VND, pre-factor
      marketCurrency: r.market_currency || 'VND',
      marketSource: r.market_source || '',
      marketUpdatedAt: r.market_updated_at || null,
      note: r.note || '', createdAt: r.created_at || null
    };
  }

  function mapLot(r) {
    return {
      id: r.id, cardId: r.card_id, qty: r.qty, qtyRemaining: r.qty_remaining,
      costPerUnit: r.cost_per_unit, importDate: r.import_date, source: r.source || '',
      condition: r.condition || 'NM', variant: r.variant || 'Normal',
      holoPattern: r.holo_pattern || null,
      createdAt: r.created_at || null
    };
  }

  function mapOrder(r) {
    return {
      id: r.id, date: r.date, channel: r.channel,
      items: (r.items || []).map(function (it) {
        return { cardId: it.card_id, lotId: it.lot_id, qty: it.qty, sellPrice: it.sell_price, costPerUnit: it.cost_per_unit };
      }),
      fees: r.fees || 0, shippingFee: r.shipping_fee || 0,
      buyer: r.buyer || '', note: r.note || '', createdAt: r.created_at || null
    };
  }

  function mapCustomSet(r) {
    return { id: r.id, name: r.name, total: r.total, official: r.official, year: r.year, note: r.note || '', createdAt: r.created_at || null };
  }

  function mapListing(r) {
    return {
      id: r.id, cardId: r.card_id, lotId: r.lot_id || null,
      price: Number(r.price) || 0, qty: Number(r.qty) || 1,
      status: r.status || 'draft', channel: r.channel || '',
      createdAt: r.created_at || null
    };
  }

  // Cột có thể chưa tồn tại trong DB (chỉ có anon key, không tự ALTER).
  // Thử insert kèm cột → lỗi thì insert lại không có cột đó + cảnh báo (cache kết quả).
  var _missingCols = {};

  // Khớp tên cột trong message lỗi 42703 — dùng boundary để 'market_price'
  // không khớp nhầm với 'market_price_usd'.
  function colMentioned(col, msg) {
    var esc = col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z0-9_])' + esc + '([^a-z0-9_]|$)', 'i').test(msg || '');
  }
  async function tolerantIns(table, row, maybeCols) {
    maybeCols = maybeCols || [];
    var filtered = {};
    Object.keys(row).forEach(function (k) {
      if (_missingCols[table + '.' + k]) return;
      filtered[k] = row[k];
    });
    try {
      return (await SB.ins(table, [filtered]))[0];
    } catch (e) {
      var missed = [];
      maybeCols.forEach(function (c) {
        if (!_missingCols[table + '.' + c] && colMentioned(c, e.message)) {
          _missingCols[table + '.' + c] = true; missed.push(c);
        }
      });
      if (!missed.length) throw e;
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[bct] bảng ' + table + ' thiếu cột (' + missed.join(', ') + ') — bỏ qua khi insert.');
      }
      var retry = {};
      Object.keys(row).forEach(function (k) {
        if (!_missingCols[table + '.' + k]) retry[k] = row[k];
      });
      return (await SB.ins(table, [retry]))[0];
    }
  }

  async function tolerantUpd(table, patch, filters, maybeCols) {
    maybeCols = maybeCols || [];
    var filtered = {};
    Object.keys(patch).forEach(function (k) {
      if (_missingCols[table + '.' + k]) return;
      filtered[k] = patch[k];
    });
    try {
      return await SB.upd(table, filtered, filters);
    } catch (e) {
      var missed = [];
      maybeCols.forEach(function (c) {
        if (!_missingCols[table + '.' + c] && colMentioned(c, e.message)) {
          _missingCols[table + '.' + c] = true; missed.push(c);
        }
      });
      if (!missed.length) throw e;
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[bct] bảng ' + table + ' thiếu cột (' + missed.join(', ') + ') — bỏ qua khi update.');
      }
      var retry = {};
      Object.keys(patch).forEach(function (k) {
        if (!_missingCols[table + '.' + k]) retry[k] = patch[k];
      });
      return await SB.upd(table, retry, filters);
    }
  }

  // ---------- load ----------
  // Cờ "đã qua lần nạp mẫu đầu tiên / đã xóa mẫu" — lưu local.
  // Không có cờ này, load() sẽ nạp lại dữ liệu mẫu MỖI lần kho trống,
  // kể cả khi user đã chủ động xóa mẫu để bắt đầu kho thật.
  var SEED_DONE_KEY = 'bct_seed_done_v1';
  var _seedDoneMem = false;
  function seedDone() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage.getItem(SEED_DONE_KEY) === '1';
    } catch (e) { /* private mode / node */ }
    return _seedDoneMem;
  }
  function markSeedDone() {
    _seedDoneMem = true;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(SEED_DONE_KEY, '1');
    } catch (e) {}
  }

  function blankState() {
    return { cards: [], lots: [], orders: [], setTotals: {}, customSets: [], listings: [] };
  }

  async function load() {
    var cards = await SB.q('cards', { order: 'created_at.asc' });
    var lots = await SB.q('inventory_lots', { order: 'import_date.asc,created_at.asc' });
    var orders = await SB.q('orders', { order: 'date.asc,created_at.asc' });
    var images = await SB.q('card_images', { order: 'sort_order.asc' });
    var csets = await SB.q('custom_sets', { order: 'created_at.asc' });
    var totals = await SB.q('set_totals', {});
    // Bảng listings thuộc Phase 2 — DB cũ có thể chưa tạo bảng này.
    // Lỗi ở đây KHÔNG được làm sập toàn bộ app: thiếu bảng thì coi như chưa có rao bán.
    var listings = [];
    try { listings = await SB.q('listings', { order: 'created_at.asc' }); } catch (e) { listings = []; }

    var imgByCard = {};
    images.forEach(function (r) {
      (imgByCard[r.card_id] = imgByCard[r.card_id] || []).push(r.url);
    });

    var state = blankState();
    state.cards = cards.map(function (r) { return mapCard(r, imgByCard[r.id] || []); });
    state.lots = lots.map(mapLot);
    state.orders = orders.map(mapOrder);
    state.customSets = csets.map(mapCustomSet);
    state.listings = listings.map(mapListing);
    totals.forEach(function (r) { state.setTotals[r.set_key] = r.total; });

    // Chỉ tự nạp dữ liệu mẫu ở lần mở ĐẦU TIÊN (chưa từng seed / chưa từng xóa mẫu).
    // Kho trống do user chủ động xóa mẫu thì giữ nguyên trống.
    if (!state.cards.length && !seedDone() && root.BCT_SEED && root.BCT_SEED.buildSeed) {
      state = await root.BCT_SEED.buildSeed(state);
      state._justSeeded = true; // UI dùng để hiện nút "Xóa dữ liệu mẫu"
      markSeedDone();
    }
    return state;
  }

  // ---------- ghi: card ----------
  // Các cột có thể chưa tồn tại trong DB (migrate SQL chạy riêng) → insert/update tolerant
  var CARD_MAYBE_COLS = ['language', 'storage_location', 'misprint', 'cert_number',
    'cert_pop', 'price_sources', 'market_price', 'market_currency',
    'market_source', 'market_updated_at'];
  var LOT_MAYBE_COLS = ['holo_pattern'];

  function cardRow(def) {
    return {
      name: def.name, set: def.set || null, set_id: def.setId || null,
      number: def.number || null, rarity: def.rarity || null,
      condition: def.condition || 'A',
      graded_org: def.graded ? def.graded.org : null,
      graded_score: def.graded ? (def.graded.score || null) : null,
      note: def.note || '',
      language: def.language || 'en',
      storage_location: def.storageLocation || null,
      misprint: def.misprint ? true : false,
      cert_number: def.certNumber || null,
      cert_pop: def.certPop != null && def.certPop !== '' ? Math.floor(Number(def.certPop)) : null,
      price_sources: def.priceSources || null,
      market_price: def.marketPrice != null ? Number(def.marketPrice) : null,
      market_currency: def.marketCurrency || 'VND',
      market_source: def.marketSource || null,
      market_updated_at: def.marketUpdatedAt || null
    };
  }

  async function addCard(state, def) {
    if (!def.name || !String(def.name).trim()) throw new Error('Nhập tên card.');
    var r = await tolerantIns('cards', cardRow(def), CARD_MAYBE_COLS);
    var card = mapCard(r, []);
    state.cards.push(card);
    return card;
  }

  async function updateCard(state, id, patch) {
    // patch thêm: {storageLocation,misprint,certNumber,certPop,priceSources,marketPrice,marketCurrency,marketSource,marketUpdatedAt}
    var row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.set !== undefined) row.set = patch.set || null;
    if (patch.setId !== undefined) row.set_id = patch.setId || null;
    if (patch.number !== undefined) row.number = patch.number || null;
    if (patch.rarity !== undefined) row.rarity = patch.rarity || null;
    if (patch.condition !== undefined) row.condition = patch.condition;
    if (patch.language !== undefined) row.language = patch.language || 'en';
    if (patch.note !== undefined) row.note = patch.note || '';
    if (patch.storageLocation !== undefined) row.storage_location = patch.storageLocation || null;
    if (patch.misprint !== undefined) row.misprint = !!patch.misprint;
    if (patch.certNumber !== undefined) row.cert_number = patch.certNumber || null;
    if (patch.certPop !== undefined) row.cert_pop = (patch.certPop != null && patch.certPop !== '') ? Math.floor(Number(patch.certPop)) : null;
    if (patch.priceSources !== undefined) row.price_sources = patch.priceSources || null;
    if (patch.marketPrice !== undefined) row.market_price = patch.marketPrice != null && patch.marketPrice !== '' ? Number(patch.marketPrice) : null;
    if (patch.marketCurrency !== undefined) row.market_currency = patch.marketCurrency || 'VND';
    if (patch.marketSource !== undefined) row.market_source = patch.marketSource || null;
    if (patch.marketUpdatedAt !== undefined) row.market_updated_at = patch.marketUpdatedAt || null;
    if (patch.graded !== undefined) {
      row.graded_org = patch.graded ? patch.graded.org : null;
      row.graded_score = patch.graded ? (patch.graded.score || null) : null;
    }
    await tolerantUpd('cards', row, { id: id }, CARD_MAYBE_COLS);
    var c = getCard(state, id);
    if (c) {
      Object.keys(patch).forEach(function (k) { c[k] = patch[k]; });
    }
    return c;
  }

  // ---------- ghi: ảnh ----------
  // Upload dataURL[] lên bucket card-images/{cardId}/, lưu card_images, cập nhật state.
  // Chỉ dùng cho ảnh user tự chụp; ảnh chính thức lấy tự động từ TCGdex CDN.
  async function uploadImageToCard(state, cardId, dataURLs) {
    var urls = [];
    for (var i = 0; i < dataURLs.length; i++) {
      var blob = await SB.dataURLtoBlob(dataURLs[i]);
      var path = cardId + '/' + Date.now().toString(36) + '_' + i + '.jpg';
      var url = await SB.upload('card-images', path, blob, 'image/jpeg');
      urls.push(url);
    }
    var rows = urls.map(function (u, i) {
      return { card_id: cardId, url: u, sort_order: i };
    });
    if (rows.length) await SB.ins('card_images', rows);
    var c = getCard(state, cardId);
    if (c) c.images = c.images.concat(urls);
    return urls;
  }

  // ---------- ghi: lô ----------
  async function addLot(state, def) {
    var qty = Math.floor(Number(def.qty) || 0);
    var cost = Math.round(Number(def.costPerUnit) || 0);
    if (qty <= 0) throw new Error('Nhập số lượng lớn hơn 0.');
    if (cost < 0) throw new Error('Giá cost không hợp lệ.');
    var r = await tolerantIns('inventory_lots', {
      card_id: def.cardId, qty: qty, qty_remaining: qty,
      cost_per_unit: cost, import_date: def.importDate,
      source: def.source || '', condition: def.condition || 'A',
      variant: def.variant || 'Normal',
      holo_pattern: def.holoPattern || null
    }, LOT_MAYBE_COLS);
    var lot = mapLot(r);
    state.lots.push(lot);
    return lot;
  }

  // ---------- FIFO ----------
  function lotsSorted(state, cardId) {
    return state.lots
      .filter(function (l) { return l.cardId === cardId && l.qtyRemaining > 0; })
      .sort(function (a, b) {
        if (a.importDate < b.importDate) return -1;
        if (a.importDate > b.importDate) return 1;
        return a.createdAt < b.createdAt ? -1 : 1;
      });
  }

  // Kế hoạch trừ kho, KHÔNG thay đổi state/DB. Ném lỗi nếu không đủ hàng.
  function previewFIFO(state, cardId, qty) {
    qty = Math.floor(Number(qty) || 0);
    if (qty <= 0) throw new Error('Số lượng phải lớn hơn 0.');
    var plan = [];
    var need = qty;
    var sorted = lotsSorted(state, cardId);
    for (var i = 0; i < sorted.length && need > 0; i++) {
      var take = Math.min(need, sorted[i].qtyRemaining);
      plan.push({ lotId: sorted[i].id, qty: take, costPerUnit: sorted[i].costPerUnit, importDate: sorted[i].importDate, source: sorted[i].source });
      need -= take;
    }
    if (need > 0) {
      var have = sorted.reduce(function (t, l) { return t + l.qtyRemaining; }, 0);
      throw new Error('Không đủ hàng tồn. Cần ' + qty + ', kho còn ' + have + '.');
    }
    return plan;
  }

  // Trừ kho thật theo FIFO: PATCH qty_remaining từng lô + cập nhật state.
  // Không bao giờ để qtyRemaining âm.
  async function consumeFIFO(state, cardId, qty) {
    var plan = previewFIFO(state, cardId, qty);
    for (var i = 0; i < plan.length; i++) {
      var p = plan[i];
      var lot = null;
      for (var j = 0; j < state.lots.length; j++) {
        if (state.lots[j].id === p.lotId) { lot = state.lots[j]; break; }
      }
      if (!lot) throw new Error('Lô hàng không tồn tại: ' + p.lotId);
      var next = lot.qtyRemaining - p.qty;
      if (next < 0) next = 0;
      await SB.upd('inventory_lots', { qty_remaining: next }, { id: p.lotId });
      lot.qtyRemaining = next;
    }
    return plan;
  }

  // ---------- selectors (sync, đọc state) ----------
  function getCard(state, id) {
    for (var i = 0; i < state.cards.length; i++) if (state.cards[i].id === id) return state.cards[i];
    return null;
  }

  function stockOf(state, cardId) {
    return lotsSorted(state, cardId).reduce(function (t, l) { return t + l.qtyRemaining; }, 0);
  }

  // Breakdown tồn kho theo phiên bản in (+ mẫu holo nếu có) — dùng cho chế độ Master
  function variantBreakdown(state, cardId) {
    var map = {};
    lotsSorted(state, cardId).forEach(function (l) {
      var v = l.variant || 'Normal';
      var hp = l.holoPattern || null;
      var k = v + '|' + (hp || '');
      if (!map[k]) map[k] = { variant: v, holoPattern: hp, qty: 0 };
      map[k].qty += l.qtyRemaining;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function avgCostOf(state, cardId) {
    var lots = lotsSorted(state, cardId);
    var q = 0, v = 0;
    lots.forEach(function (l) { q += l.qtyRemaining; v += l.qtyRemaining * l.costPerUnit; });
    return q > 0 ? v / q : 0;
  }

  function cardByName(state, name) {
    name = String(name).toLowerCase().trim();
    for (var i = 0; i < state.cards.length; i++) {
      if (String(state.cards[i].name).toLowerCase().trim() === name) return state.cards[i];
    }
    return null;
  }

  // ---------- orders ----------
  function orderRevenue(order) {
    return order.items.reduce(function (t, it) { return t + it.qty * it.sellPrice; }, 0);
  }

  function orderCost(order) {
    return order.items.reduce(function (t, it) { return t + it.qty * it.costPerUnit; }, 0);
  }

  function orderProfit(order) {
    return orderRevenue(order) - orderCost(order) - (Number(order.fees) || 0) - (Number(order.shippingFee) || 0);
  }

  function orderQty(order) {
    return order.items.reduce(function (t, it) { return t + it.qty; }, 0);
  }

  // Tạo đơn bán: trừ FIFO từng dòng (ghi DB), lưu costPerUnit thực tế vào item.
  async function createOrder(state, input) {
    // input: { date, channel, buyer, fees, shippingFee, note, lines: [{cardId, qty, sellPrice}] }
    if (!input.lines || !input.lines.length) throw new Error('Đơn hàng phải có ít nhất 1 dòng.');
    var items = [];
    for (var i = 0; i < input.lines.length; i++) {
      var ln = input.lines[i];
      var cardId = ln.cardId;
      var qty = Math.floor(Number(ln.qty) || 0);
      var sellPrice = Math.round(Number(ln.sellPrice) || 0);
      if (qty <= 0) throw new Error('Số lượng phải lớn hơn 0.');
      if (sellPrice < 0) throw new Error('Giá bán không hợp lệ.');
      var plan = await consumeFIFO(state, cardId, qty); // ném lỗi nếu thiếu hàng → không lưu đơn
      plan.forEach(function (p) {
        items.push({ cardId: cardId, lotId: p.lotId, qty: p.qty, sellPrice: sellPrice, costPerUnit: p.costPerUnit });
      });
    }
    var dbItems = items.map(function (it) {
      return { card_id: it.cardId, lot_id: it.lotId, qty: it.qty, sell_price: it.sellPrice, cost_per_unit: it.costPerUnit };
    });
    var r = (await SB.ins('orders', [{
      date: input.date || todayISO(),
      channel: input.channel || 'tructiep',
      items: dbItems,
      fees: Math.round(Number(input.fees) || 0),
      shipping_fee: Math.round(Number(input.shippingFee) || 0),
      buyer: input.buyer || '',
      note: input.note || ''
    }]))[0];
    var order = mapOrder(r);
    state.orders.push(order);
    return order;
  }

  // ---------- dashboard aggregates (sync) ----------
  function totals(state) {
    var stock = 0, capital = 0;
    state.cards.forEach(function (c) {
      var s = stockOf(state, c.id);
      stock += s;
      capital += s * avgCostOf(state, c.id);
    });
    var revenue = 0, profit = 0, sold = 0;
    state.orders.forEach(function (o) {
      revenue += orderRevenue(o);
      profit += orderProfit(o);
      sold += orderQty(o);
    });
    return { stock: stock, capital: capital, revenue: revenue, profit: profit, sold: sold, orders: state.orders.length };
  }

  function weeklySeries(state, weeks) {
    weeks = weeks || 8;
    var out = [];
    var now = new Date(); now.setHours(23, 59, 59, 999);
    for (var w = weeks - 1; w >= 0; w--) {
      var end = new Date(now.getTime() - w * 7 * 86400000);
      var start = new Date(end.getTime() - 6 * 86400000); start.setHours(0, 0, 0, 0);
      var rev = 0, prof = 0;
      state.orders.forEach(function (o) {
        var d = new Date(o.date.length <= 10 ? o.date + 'T00:00:00' : o.date);
        if (d >= start && d <= end) { rev += orderRevenue(o); prof += orderProfit(o); }
      });
      out.push({
        label: String(start.getDate()).padStart(2, '0') + '/' + String(start.getMonth() + 1).padStart(2, '0'),
        revenue: rev, profit: prof
      });
    }
    return out;
  }

  function topSellers(state, n) {
    var map = {};
    state.orders.forEach(function (o) {
      o.items.forEach(function (it) {
        map[it.cardId] = map[it.cardId] || { qty: 0, revenue: 0 };
        map[it.cardId].qty += it.qty;
        map[it.cardId].revenue += it.qty * it.sellPrice;
      });
    });
    var arr = Object.keys(map).map(function (id) {
      return { card: getCard(state, id), qty: map[id].qty, revenue: map[id].revenue };
    }).filter(function (x) { return x.card; });
    arr.sort(function (a, b) { return b.qty - a.qty; });
    return arr.slice(0, n || 5);
  }

  function slowMovers(state, n) {
    var arr = [];
    state.cards.forEach(function (c) {
      var s = stockOf(state, c.id);
      if (s <= 0) return;
      var oldest = lotsSorted(state, c.id)[0];
      if (!oldest) return;
      var days = Math.floor((Date.now() - new Date(oldest.importDate + 'T00:00:00').getTime()) / 86400000);
      arr.push({ card: c, stock: s, days: days, oldestDate: oldest.importDate });
    });
    arr.sort(function (a, b) { return b.days - a.days; });
    return arr.slice(0, n || 5);
  }

  function lowStock(state, threshold) {
    threshold = threshold == null ? 2 : threshold;
    var arr = [];
    state.cards.forEach(function (c) {
      var s = stockOf(state, c.id);
      if (s > 0 && s <= threshold) arr.push({ card: c, stock: s });
    });
    arr.sort(function (a, b) { return a.stock - b.stock; });
    return arr;
  }

  function priceHistory(state, cardId) {
    var rows = [];
    state.orders.forEach(function (o) {
      o.items.forEach(function (it) {
        if (it.cardId === cardId) rows.push({ date: o.date, sellPrice: it.sellPrice, qty: it.qty, channel: o.channel });
      });
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return rows;
  }

  function ordersOfCard(state, cardId) {
    return state.orders.filter(function (o) {
      return o.items.some(function (it) { return it.cardId === cardId; });
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  // ---------- set tự tạo ----------
  function getCustomSet(state, id) {
    if (!id || !state.customSets) return null;
    for (var i = 0; i < state.customSets.length; i++) {
      if (state.customSets[i].id === id) return state.customSets[i];
    }
    return null;
  }

  function customSetByName(state, name) {
    if (!name || !state.customSets) return null;
    var n = String(name).toLowerCase().trim();
    for (var i = 0; i < state.customSets.length; i++) {
      if (String(state.customSets[i].name).toLowerCase().trim() === n) return state.customSets[i];
    }
    return null;
  }

  function validateCustomSet(input) {
    var errs = [];
    var name = String(input.name || '').trim();
    if (!name) errs.push('Nhập tên set.');
    var total = Math.floor(Number(input.total));
    if (!(total > 0)) errs.push('Tổng số lá phải là số nguyên lớn hơn 0.');
    var official = Math.floor(Number(input.official));
    if (!(official > 0)) errs.push('Số lá chính phải là số nguyên lớn hơn 0.');
    else if (total > 0 && official > total) errs.push('Số lá chính không được vượt tổng số lá.');
    var year = (input.year == null || input.year === '') ? null : Math.floor(Number(input.year));
    if (year != null && !(year >= 1990 && year <= 2100)) errs.push('Năm phát hành không hợp lệ.');
    if (errs.length) throw new Error(errs.join(' '));
    return { name: name, total: total, official: official, year: year, note: String(input.note || '').trim() };
  }

  async function createCustomSet(state, input) {
    var v = validateCustomSet(input);
    var id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var r = (await SB.ins('custom_sets', [{
      id: id, name: v.name, total: v.total, official: v.official, year: v.year, note: v.note
    }]))[0];
    var s = mapCustomSet(r);
    state.customSets.push(s);
    return s;
  }

  async function updateCustomSet(state, id, input) {
    var s = getCustomSet(state, id);
    if (!s) throw new Error('Không tìm thấy set.');
    var v = validateCustomSet(input);
    await SB.upd('custom_sets', { name: v.name, total: v.total, official: v.official, year: v.year, note: v.note }, { id: id });
    s.name = v.name; s.total = v.total; s.official = v.official; s.year = v.year; s.note = v.note;
    return s;
  }

  function cardsOfCustomSet(state, id) {
    return state.cards.filter(function (c) { return c.setId === id; });
  }

  // Xóa set tự tạo: các card đang gắn sẽ bị gỡ khỏi set. Trả về số card bị dời.
  async function deleteCustomSet(state, id) {
    var moved = 0;
    var affected = cardsOfCustomSet(state, id);
    for (var i = 0; i < affected.length; i++) {
      await SB.upd('cards', { set_id: null, set: null }, { id: affected[i].id });
      affected[i].setId = null; affected[i].set = '';
      moved++;
    }
    await SB.del('custom_sets', { id: id });
    state.customSets = state.customSets.filter(function (s) { return s.id !== id; });
    return moved;
  }

  // ---------- bộ sưu tập theo set ----------
  // Phân giải thông tin set của card. Thứ tự: custom set theo id → db theo setId →
  // db theo tên → custom theo tên → user tự nhập (set_totals) → null (chưa rõ).
  // Trả về { key, id, name, total, official, year, source }
  function resolveSet(state, cardOrKey) {
    var key, setId = null, name = null;
    if (typeof cardOrKey === 'string') { key = cardOrKey; }
    else { setId = cardOrKey.setId || null; name = cardOrKey.set || null; key = setId || name || ''; }
    var csById = (setId && getCustomSet(state, setId)) ||
      (typeof cardOrKey === 'string' && getCustomSet(state, cardOrKey));
    if (csById) {
      var c0 = csById;
      return { key: c0.id, id: c0.id, name: c0.name, total: c0.total, official: c0.official,
        year: c0.year, note: c0.note, source: 'custom', custom: true };
    }
    var db = setsDB(), info = null;
    if (db) {
      if (setId) info = db.byId(setId);
      if (!info && name) info = db.byName(name);
      if (!info && typeof cardOrKey === 'string') info = db.byId(key) || db.byName(key);
    }
    if (info) {
      return { key: info.id, id: info.id, name: info.name, total: info.total,
        official: info.official, year: info.year == null ? null : info.year, source: 'db' };
    }
    var csByName = name && customSetByName(state, name);
    if (csByName) {
      var c1 = csByName;
      return { key: c1.id, id: c1.id, name: c1.name, total: c1.total, official: c1.official,
        year: c1.year, note: c1.note, source: 'custom', custom: true };
    }
    if (key && state.setTotals && state.setTotals[key] != null) {
      var t = Math.floor(Number(state.setTotals[key]));
      if (t > 0) return { key: key, id: null, name: name || key, total: t, official: null, year: null, source: 'manual' };
    }
    return { key: key, id: null, name: name || key || 'Chưa phân loại', total: null, official: null, year: null, source: null };
  }

  function isSecretCard(card, info) {
    var n = parseCardNumber(card.number);
    return n != null && info.official != null && n > info.official;
  }

  // Gom card theo set
  function setGroups(state) {
    var map = {};
    state.cards.forEach(function (c) {
      var info = resolveSet(state, c);
      var k = info.key || '__none__';
      if (!map[k]) map[k] = { key: k, info: info, cards: [] };
      if (info.source === 'db' && map[k].info.source !== 'db') map[k].info = info;
      map[k].cards.push(c);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  // Tiến độ sưu tập của 1 set: unique số thứ tự còn hàng ÷ tổng số lá
  function setProgress(state, group) {
    var info = group.info;
    var total = info.total;
    var ownedNums = {};
    var qty = 0, value = 0;
    group.cards.forEach(function (c) {
      var s = stockOf(state, c.id);
      qty += s;
      value += s * avgCostOf(state, c.id);
      if (s > 0) {
        var n = parseCardNumber(c.number);
        if (n != null && (total == null || n <= total)) {
          (ownedNums[n] = ownedNums[n] || []).push(c.id);
        }
      }
    });
    var unique = Object.keys(ownedNums).length;
    var secrets = group.cards.filter(function (c) {
      return stockOf(state, c.id) > 0 && isSecretCard(c, info);
    });
    var rarest = group.cards.filter(function (c) {
      return stockOf(state, c.id) > 0 && RAREST.indexOf(c.rarity) >= 0;
    });
    return {
      total: total, official: info.official, unique: unique,
      missing: total != null ? total - unique : null,
      qty: qty, value: value, ownedNums: ownedNums,
      secrets: secrets, rarest: rarest,
      pct: total ? Math.round(unique / total * 100) : null
    };
  }

  async function setManualTotal(state, key, total) {
    total = Math.floor(Number(total));
    if (!(total > 0)) throw new Error('Tổng số lá phải lớn hơn 0.');
    await SB.upsert('set_totals', [{ set_key: key, total: total }], 'set_key');
    state.setTotals[key] = total;
  }

  function yearGroups(state) {
    var groups = setGroups(state);
    var map = {};
    groups.forEach(function (g) {
      var y = g.info.year;
      var k = y == null ? '__unknown__' : String(y);
      if (!map[k]) map[k] = { year: y, groups: [] };
      map[k].groups.push(g);
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      if (a.year == null) return 1;
      if (b.year == null) return -1;
      return b.year - a.year;
    });
  }

  // Ngôn ngữ chiếm đa số trong 1 set group (để gắn tag EN/JP). Trả về 'en'|'jp'|'other'|null.
  function groupLanguage(state, group) {
    var counts = { en: 0, jp: 0, other: 0 };
    var total = 0;
    group.cards.forEach(function (c) {
      if (stockOf(state, c.id) <= 0) return;
      var l = c.language || 'en';
      if (!counts.hasOwnProperty(l)) l = 'other';
      counts[l]++; total++;
    });
    if (!total) return null;
    var top = 'en', topN = counts.en;
    ['jp', 'other'].forEach(function (l) { if (counts[l] > topN) { top = l; topN = counts[l]; } });
    return topN > total / 2 ? top : null;
  }

  // ---------- giá thị trường tham khảo (TCGdex pricing, đa nguồn, free, không cần key) ----------
  // GET https://api.tcgdex.net/v2/en/cards/{setId}-{localId} → field `pricing`
  // { cardmarket: { updated, unit:"EUR", trend, avg, ... }, tcgplayer: { updated, unit:"USD", holofoil:{marketPrice}, normal:{marketPrice}, ... } }
  // localId giữ nguyên zero-padding ("006"); promo "SWSH230" thử nguyên chuỗi.
  // Nguồn nhập tay (vd giá eBay JP bằng JPY): {source:'ebay'|..., currency:'JPY', kind:'manual'}

  // Định nghĩa nguồn giá từ config (pluggable). Fallback nếu config chưa có.
  function priceSourceDefs() {
    var g = (typeof window !== 'undefined') ? window
      : ((typeof globalThis !== 'undefined') ? globalThis : null);
    if (g && Array.isArray(g.PRICE_SOURCE_DEFS) && g.PRICE_SOURCE_DEFS.length) return g.PRICE_SOURCE_DEFS;
    return [
      { key: 'cardmarket', label: 'Cardmarket', auto: 'tcgdex' },
      { key: 'tcgplayer', label: 'TCGplayer', auto: 'tcgdex' },
      { key: 'ebay', label: 'eBay', auto: 'ebay', comingSoon: true },
      { key: 'other', label: 'Khác', auto: null }
    ];
  }

  function sourceLabel(k) {
    var defs = priceSourceDefs();
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].key === k) return defs[i].label;
    }
    return k;
  }

  function ebayAppId() {
    var g = (typeof window !== 'undefined') ? window
      : ((typeof globalThis !== 'undefined') ? globalThis : null);
    return (g && g.EBAY_APP_ID) || '';
  }

  function cfgNum(name, fallback) {
    var g = (typeof window !== 'undefined') ? window
      : ((typeof globalThis !== 'undefined') ? globalThis : null);
    var v = g ? g[name] : undefined;
    return typeof v === 'number' && v > 0 ? v : fallback;
  }

  function toVND(amount, currency) {
    var rate = currency === 'USD' ? cfgNum('USD_VND', 26000)
      : currency === 'JPY' ? cfgNum('JPY_VND', 170)
      : cfgNum('EUR_VND', 28000);
    return Number(amount) * rate;
  }

  // Hệ số condition (chuẩn hoá NM/LP/MP cũ trước khi tra)
  function condFactor(cond) {
    var g = (typeof window !== 'undefined') ? window
      : ((typeof globalThis !== 'undefined') ? globalThis : null);
    var map = (g && g.CONDITION_FACTOR) || { 'New Mint': 1.0, 'A': 0.9, 'B': 0.75, 'C': 0.55, 'D': 0.35 };
    var c = CONDITION_OLD_MAP[cond] || cond;
    return map[c] != null ? map[c] : 1;
  }

  // Parse thuần túy: pricing object (TCGdex) → [{source,price,currency,kind,updated_at}]
  function parsePricingSources(pricing) {
    var out = [];
    if (!pricing) return out;
    var cm = pricing.cardmarket;
    if (cm) {
      var p = firstNonNull(cm.trend, cm.avg);
      if (p != null) out.push({
        source: 'cardmarket', price: Number(p), currency: 'EUR',
        kind: cm.trend != null ? 'trend' : 'avg',
        updated_at: cm.updated || cm.updatedAt || null
      });
    }
    var tp = pricing.tcgplayer;
    if (tp) {
      var tpp = firstNonNull(
        tp.holofoil && tp.holofoil.marketPrice,
        tp.normal && tp.normal.marketPrice,
        tp['reverse-holofoil'] && tp['reverse-holofoil'].marketPrice
      );
      if (tpp != null) out.push({
        source: 'tcgplayer', price: Number(tpp), currency: 'USD',
        kind: 'market',
        updated_at: tp.updated || tp.updatedAt || null
      });
    }
    return out;
  }

  // fetch có timeout (tránh treo khi proxy/mạng đứng)
  function fetchWithTimeout(url, opts, ms) {
    ms = ms || 15000;
    var doFetch = typeof fetch !== 'undefined' ? fetch : null;
    if (!doFetch) return Promise.reject(new Error('Môi trường không hỗ trợ fetch.'));
    if (typeof AbortController === 'undefined') return doFetch(url, opts);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    var o2 = {};
    if (opts) { for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) o2[k] = opts[k]; } }
    o2.signal = ctrl.signal;
    return doFetch(url, o2).then(function (res) {
      clearTimeout(timer);
      return res;
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('TCGdex API timeout (quá 15s).');
      throw err;
    });
  }

  // ---- Registry fetcher theo nguồn (pluggable) ----
  // Mỗi fetcher: async (setId, number, card) → [sourceEntry...] (mảng rỗng nếu không có giá).
  // Thêm nguồn mới: viết fetcher ở đây + trỏ def.auto trong config tới tên này.
  var PRICE_FETCHERS = {
    tcgdex: fetchTcgdexPricing, // 1 call trả về cả cardmarket + tcgplayer
    ebay: fetchEbayPricing       // slot chờ App ID
  };

  // TCGdex: trả về [cardmarket?, tcgplayer?]. Retry + timeout nội bộ.
  async function fetchTcgdexPricing(setId, number) {
    var url = 'https://api.tcgdex.net/v2/en/cards/' +
      encodeURIComponent(String(setId).trim()) + '-' +
      encodeURIComponent(String(number).trim());
    var lastErr = null;
    for (var i = 0; i < 3; i++) {
      try {
        var res = await fetchWithTimeout(url, null, 15000);
        if (res.status === 404) return [];
        if (!res.ok) throw new Error('TCGdex API lỗi HTTP ' + res.status);
        var j = await res.json();
        return parsePricingSources(j.pricing);
      } catch (err) {
        lastErr = err;
        if (i < 2) await new Promise(function (r) { setTimeout(r, 800 * (i + 1)); });
      }
    }
    throw lastErr;
  }

  // eBay: SLOT chờ duyệt App ID (dev kavie2004). Hiện tại trả [] êm thấm.
  // Khi có App ID, viết body theo hướng dẫn:
  //   1) Lấy access token (client credentials):
  //      POST https://api.ebay.com/identity/v1/oauth2/token
  //      header Authorization: Basic base64(EBAY_APP_ID:EBAY_CERT_ID), body grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope
  //   2) Tìm listing:
  //      GET https://api.ebay.com/buy/browse/v1/item_summary/search?q=<tên + set + number>&category_ids=21282&limit=20&sort=price
  //      headers: Authorization: Bearer <token>, X-EBAY-C-MARKETPLACE-ID: EBAY_US
  //   3) Lấy trung vị vài listing rẻ nhất → {source:'ebay', price, currency, kind:'listing', updated_at: now}.
  //      (Muốn giá đã bán: dùng Finding API findCompletedItems — cần thêm scope.)
  async function fetchEbayPricing(setId, number, card) {
    var appId = ebayAppId();
    if (!appId) return []; // chưa có App ID → bỏ qua, không lỗi
    // TODO: implement khi eBay duyệt xong (xem hướng dẫn trên).
    return [];
  }

  // Kéo giá TẤT CẢ nguồn auto đang bật (theo PRICE_SOURCE_DEFS).
  // Mỗi fetcher lỗi → warn + tiếp tục nguồn khác. Trả về mảng gộp, hoặc null nếu không có giá.
  async function fetchMarketPrices(setId, number, card) {
    if (!setId || number == null || String(number).trim() === '') {
      var e = new Error('NO_ID');
      e.code = 'NO_ID';
      throw e;
    }
    var defs = priceSourceDefs();
    var used = {}, out = [], i, d, fn, arr, k;
    for (i = 0; i < defs.length; i++) {
      d = defs[i];
      if (!d.auto || used[d.auto]) continue;
      fn = PRICE_FETCHERS[d.auto];
      if (!fn) continue;
      used[d.auto] = true;
      try {
        arr = await fn(setId, number, card);
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[bct] nguồn giá lỗi (' + d.auto + '): ' + (err.message || err));
        }
        continue;
      }
      if (arr) for (k = 0; k < arr.length; k++) out.push(arr[k]);
    }
    return out.length ? out : null;
  }

  // Mỗi nguồn → dòng giá: giá gốc + quy VND + giá sau hệ số condition của lá bài.
  // Không tính trung bình — hiển thị tất cả các nguồn.
  function marketSourceRows(card) {
    var srcs = card.priceSources && card.priceSources.length ? card.priceSources : null;
    if (!srcs) return null;
    var f = condFactor(card.condition);
    return srcs.map(function (s) {
      var vnd = Math.round(toVND(s.price, s.currency));
      return {
        source: s.source, label: sourceLabel(s.source),
        price: Number(s.price), currency: s.currency, kind: s.kind || '',
        updated_at: s.updated_at || null,
        vnd: vnd, vndCond: Math.round(vnd * f)
      };
    });
  }

  // Khoảng giá min–max (sau condition) + số nguồn. Null nếu chưa có giá.
  function marketRangeVND(card) {
    var rows = marketSourceRows(card);
    if (!rows) {
      if (card.marketPrice != null) {
        var v = Math.round(Number(card.marketPrice));
        return { min: v, max: v, count: 0 };
      }
      return null;
    }
    var min = rows[0].vndCond, max = rows[0].vndCond, i;
    for (i = 1; i < rows.length; i++) {
      if (rows[i].vndCond < min) min = rows[i].vndCond;
      if (rows[i].vndCond > max) max = rows[i].vndCond;
    }
    return { min: min, max: max, count: rows.length };
  }

  function fmtPrice(n, cur) {
    if (n == null) return '—';
    var sym = cur === 'USD' ? '$' : cur === 'JPY' ? '¥' : '€';
    var opts = cur === 'JPY'
      ? { maximumFractionDigits: 0 }
      : { maximumFractionDigits: 2 };
    return sym + Number(n).toLocaleString('en-US', opts);
  }

  // Lưu giá các nguồn. market_price = giá VND CAO NHẤT sau condition (chỉ để sort/filter),
  // market_source = nguồn của giá đó. Không hiển thị như "giá chính thức".
  // Ghi tolerantly: nếu cột nào chưa migrate → tự bỏ qua cột đó.
  async function saveMarketPrices(state, cardId, sources) {
    var srcs = sources || [];
    var card = getCard(state, cardId);
    var rows = marketSourceRows({ priceSources: srcs, condition: card ? card.condition : 'A' }) || [];
    var top = null, i;
    for (i = 0; i < rows.length; i++) {
      if (!top || rows[i].vndCond > top.vndCond) top = rows[i];
    }
    var names = srcs.map(function (s) { return s.source; }).join('+');
    await updateCard(state, cardId, {
      priceSources: srcs,
      marketPrice: top ? top.vndCond : null,
      marketCurrency: 'VND',
      marketSource: top ? top.source : (names || null),
      marketUpdatedAt: new Date().toISOString()
    });
    return getCard(state, cardId);
  }

  // Nhập tay 1 nguồn giá: thay entry cùng source (nếu có), giữ các nguồn khác.
  async function addManualPrice(state, cardId, entry) {
    // entry: {source, price, currency}
    var price = Number(entry.price);
    if (!(price > 0)) throw new Error('Nhập giá hợp lệ (> 0).');
    var c = getCard(state, cardId);
    if (!c) throw new Error('Không tìm thấy card.');
    var srcs = (c.priceSources || []).filter(function (s) { return s.source !== entry.source; });
    srcs.push({
      source: entry.source, price: price, currency: entry.currency || 'EUR',
      kind: 'manual', updated_at: new Date().toISOString()
    });
    return saveMarketPrices(state, cardId, srcs);
  }

  // ---------- wipe / reseed / export ----------
  // Xóa toàn bộ dữ liệu (thứ tự an toàn FK). Trả về state trống.
  // ---------- rao bán (listings, Phase 2 — quản lý trong app, chưa phải storefront) ----------
  var LISTING_STATUSES = ['draft', 'active', 'sold', 'hidden'];
  var LISTING_STATUS_LABELS = { draft: 'Nháp', active: 'Đang rao', sold: 'Đã bán', hidden: 'Đã ẩn' };

  function listingsOfCard(state, cardId) {
    return (state.listings || []).filter(function (l) { return l.cardId === cardId; });
  }

  function getListing(state, id) {
    return (state.listings || []).filter(function (l) { return l.id === id; })[0] || null;
  }

  async function createListing(state, def) {
    if (!def.cardId || !getCard(state, def.cardId)) throw new Error('Chọn card để rao bán.');
    var price = Math.round(Number(def.price) || 0);
    var qty = Math.floor(Number(def.qty) || 0);
    if (price < 0) throw new Error('Giá rao không hợp lệ.');
    if (qty <= 0) throw new Error('Số lượng rao phải lớn hơn 0.');
    var stock = stockOf(state, def.cardId);
    if (qty > stock) throw new Error('Số lượng rao (' + qty + ') vượt tồn kho hiện có (' + stock + ').');
    var status = LISTING_STATUSES.indexOf(def.status) >= 0 ? def.status : 'draft';
    var r = (await SB.ins('listings', [{
      card_id: def.cardId, lot_id: def.lotId || null,
      price: price, qty: qty, status: status,
      channel: def.channel || null
    }]))[0];
    var listing = mapListing(r);
    state.listings = state.listings || [];
    state.listings.push(listing);
    return listing;
  }

  async function updateListing(state, id, patch) {
    var row = {};
    if (patch.price !== undefined) {
      var price = Math.round(Number(patch.price) || 0);
      if (price < 0) throw new Error('Giá rao không hợp lệ.');
      row.price = price;
    }
    if (patch.qty !== undefined) {
      var qty = Math.floor(Number(patch.qty) || 0);
      if (qty <= 0) throw new Error('Số lượng rao phải lớn hơn 0.');
      row.qty = qty;
    }
    if (patch.status !== undefined) {
      if (LISTING_STATUSES.indexOf(patch.status) < 0) throw new Error('Trạng thái rao không hợp lệ.');
      row.status = patch.status;
    }
    if (patch.channel !== undefined) row.channel = patch.channel || null;
    if (patch.lotId !== undefined) row.lot_id = patch.lotId || null;
    if (!Object.keys(row).length) return getListing(state, id);
    await SB.upd('listings', row, { id: id });
    var l = getListing(state, id);
    if (l) Object.keys(patch).forEach(function (k) { l[k] = patch[k]; });
    return l;
  }

  async function deleteListing(state, id) {
    await SB.del('listings', { id: id });
    state.listings = (state.listings || []).filter(function (l) { return l.id !== id; });
    return true;
  }

  async function wipeAll() {
    await SB.delAll('card_images', 'id');
    await SB.delAll('inventory_lots', 'id');
    await SB.delAll('listings', 'id');
    await SB.delAll('orders', 'id');
    await SB.delAll('cards', 'id');
    await SB.delAll('custom_sets', 'id');
    await SB.delAll('set_totals', 'set_key');
    markSeedDone(); // xóa sạch là chủ động bắt đầu kho trống — không tự nạp lại mẫu khi tải lại trang
    return blankState();
  }

  async function reseed() {
    await wipeAll();
    var state = blankState();
    if (root.BCT_SEED && root.BCT_SEED.buildSeed) {
      state = await root.BCT_SEED.buildSeed(state);
    }
    markSeedDone();
    return state;
  }

  async function exportJSON() {
    var out = {};
    out.cards = await SB.q('cards', { order: 'created_at.asc' });
    out.inventory_lots = await SB.q('inventory_lots', { order: 'created_at.asc' });
    out.orders = await SB.q('orders', { order: 'created_at.asc' });
    out.card_images = await SB.q('card_images', { order: 'sort_order.asc' });
    out.custom_sets = await SB.q('custom_sets', { order: 'created_at.asc' });
    out.set_totals = await SB.q('set_totals', {});
    out.listings = await SB.q('listings', { order: 'created_at.asc' });
    out.exportedAt = new Date().toISOString();
    return out;
  }

  var BCT = {
    CHANNELS: CHANNELS,
    CONDITIONS: CONDITIONS,
    LANGUAGES: LANGUAGES,
    RARITIES: RARITIES,
    VARIANTS: VARIANTS,
    HOLO_PATTERNS: HOLO_PATTERNS,
    CDN_LANG: CDN_LANG,
    fmtVND: fmtVND, fmtVNDShort: fmtVNDShort, fmtDate: fmtDate, todayISO: todayISO, esc: esc,
    blankState: blankState, load: load,
    addCard: addCard, updateCard: updateCard, uploadImageToCard: uploadImageToCard,
    addLot: addLot,
    previewFIFO: previewFIFO, consumeFIFO: consumeFIFO, lotsSorted: lotsSorted,
    getCard: getCard, stockOf: stockOf, avgCostOf: avgCostOf, cardByName: cardByName,
    variantBreakdown: variantBreakdown,
    orderRevenue: orderRevenue, orderCost: orderCost, orderProfit: orderProfit, orderQty: orderQty,
    createOrder: createOrder,
    totals: totals, weeklySeries: weeklySeries, topSellers: topSellers,
    slowMovers: slowMovers, lowStock: lowStock,
    priceHistory: priceHistory, ordersOfCard: ordersOfCard,
    cardImageURL: cardImageURL, cardImageFallbackURL: cardImageFallbackURL,
    placeholderImage: placeholderImage,
    fetchMarketPrices: fetchMarketPrices, parsePricingSources: parsePricingSources,
    priceSourceDefs: priceSourceDefs,
    fmtPrice: fmtPrice, toVND: toVND, condFactor: condFactor,
    marketSourceRows: marketSourceRows, marketRangeVND: marketRangeVND,
    saveMarketPrices: saveMarketPrices, addManualPrice: addManualPrice,
    sourceLabel: sourceLabel,
    condLabel: condLabel,
    parseCardNumber: parseCardNumber, resolveSet: resolveSet, isSecretCard: isSecretCard,
    setGroups: setGroups, setProgress: setProgress, setManualTotal: setManualTotal,
    yearGroups: yearGroups, groupLanguage: groupLanguage,
    getCustomSet: getCustomSet, customSetByName: customSetByName,
    createCustomSet: createCustomSet, updateCustomSet: updateCustomSet,
    deleteCustomSet: deleteCustomSet, cardsOfCustomSet: cardsOfCustomSet,
    LISTING_STATUSES: LISTING_STATUSES, LISTING_STATUS_LABELS: LISTING_STATUS_LABELS,
    listingsOfCard: listingsOfCard, getListing: getListing,
    createListing: createListing, updateListing: updateListing, deleteListing: deleteListing,
    wipeAll: wipeAll, reseed: reseed, exportJSON: exportJSON
  };

  root.BCT = BCT;
  if (typeof module !== 'undefined' && module.exports) module.exports = BCT;
})(typeof window !== 'undefined' ? window : globalThis);
