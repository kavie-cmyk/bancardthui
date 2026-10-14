/* Bán Card Thui — store.js
 * Quản lý state (localStorage), logic FIFO, tính toán lãi/lỗ.
 * Shape tương thích Supabase (xem supabase/schema.sql).
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'bct_state_v1';

  // ---------- utils ----------
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function fmtVND(n) {
    n = Math.round(Number(n) || 0);
    return n.toLocaleString('vi-VN') + '₫';
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

  var CONDITIONS = { NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played' };

  // 10 độ hiếm chuẩn dùng trong app (khớp rarity mới của Pokémon TCG)
  var RARITIES = ['Common', 'Uncommon', 'Rare', 'Double Rare', 'Ultra Rare',
    'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'ACE SPEC Rare', 'Promo'];
  var RAREST = ['Hyper Rare', 'Special Illustration Rare'];

  // Phiên bản in của từng lô (finish): bản thường / holo các loại
  var VARIANTS = ['Normal', 'Reverse Holo', 'Holo', '1st Edition'];

  // ---------- state ----------
  function blankState() {
    return { cards: [], lots: [], orders: [], setTotals: {}, customSets: [], isSeeded: false, createdAt: new Date().toISOString() };
  }

  var mem = (typeof localStorage === 'undefined');
  var memStore = {};

  function save(state) {
    var raw = JSON.stringify(state);
    if (mem) { memStore[STORAGE_KEY] = raw; return; }
    try { localStorage.setItem(STORAGE_KEY, raw); }
    catch (e) { throw new Error('Không lưu được dữ liệu (localStorage đầy?). Ảnh quá lớn là nguyên nhân phổ biến.'); }
  }

  function load() {
    var raw = mem ? (memStore[STORAGE_KEY] || null) : null;
    if (!mem) {
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    }
    if (!raw) return blankState();
    try {
      var s = JSON.parse(raw);
      s.cards = s.cards || []; s.lots = s.lots || []; s.orders = s.orders || [];
      s.setTotals = s.setTotals || {}; // backfill cho state cũ
      s.customSets = s.customSets || []; // backfill cho state cũ
      s.lots.forEach(function (l) { if (!l.variant) l.variant = 'Normal'; }); // backfill variant
      return s;
    } catch (e) { return blankState(); }
  }

  function wipe() {
    if (mem) { delete memStore[STORAGE_KEY]; return; }
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // ---------- FIFO (core) ----------
  function lotsSorted(state, cardId) {
    return state.lots
      .filter(function (l) { return l.cardId === cardId && l.qtyRemaining > 0; })
      .sort(function (a, b) {
        if (a.importDate < b.importDate) return -1;
        if (a.importDate > b.importDate) return 1;
        return a.createdAt < b.createdAt ? -1 : 1;
      });
  }

  // Kế hoạch trừ kho, KHÔNG thay đổi state. Ném lỗi nếu không đủ hàng.
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

  // Trừ kho thật theo FIFO. Trả về plan đã trừ. Không bao giờ để qtyRemaining âm.
  function consumeFIFO(state, cardId, qty) {
    var plan = previewFIFO(state, cardId, qty);
    plan.forEach(function (p) {
      var lot = null;
      for (var i = 0; i < state.lots.length; i++) {
        if (state.lots[i].id === p.lotId) { lot = state.lots[i]; break; }
      }
      if (!lot) throw new Error('Lô hàng không tồn tại: ' + p.lotId);
      lot.qtyRemaining -= p.qty;
      if (lot.qtyRemaining < 0) lot.qtyRemaining = 0; // phòng thủ, lý thuyết không xảy ra
    });
    return plan;
  }

  // ---------- selectors ----------
  function getCard(state, id) {
    for (var i = 0; i < state.cards.length; i++) if (state.cards[i].id === id) return state.cards[i];
    return null;
  }

  function stockOf(state, cardId) {
    return lotsSorted(state, cardId).reduce(function (t, l) { return t + l.qtyRemaining; }, 0);
  }

  // Breakdown số thẻ còn lại theo phiên bản in (dùng cho chế độ Master checklist)
  function variantBreakdown(state, cardId) {
    var map = {};
    lotsSorted(state, cardId).forEach(function (l) {
      var v = l.variant || 'Normal';
      map[v] = (map[v] || 0) + l.qtyRemaining;
    });
    return Object.keys(map).map(function (v) { return { variant: v, qty: map[v] }; });
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

  // Tạo đơn bán: trừ FIFO từng dòng, lưu costPerUnit thực tế vào item.
  function createOrder(state, input) {
    // input: { date, channel, buyer, fees, shippingFee, note, lines: [{cardId, qty, sellPrice}] }
    if (!input.lines || !input.lines.length) throw new Error('Đơn hàng phải có ít nhất 1 dòng.');
    var items = [];
    input.lines.forEach(function (ln) {
      var cardId = ln.cardId;
      var qty = Math.floor(Number(ln.qty) || 0);
      var sellPrice = Math.round(Number(ln.sellPrice) || 0);
      if (qty <= 0) throw new Error('Số lượng phải lớn hơn 0.');
      if (sellPrice < 0) throw new Error('Giá bán không hợp lệ.');
      var plan = consumeFIFO(state, cardId, qty); // ném lỗi nếu thiếu hàng → không lưu đơn
      plan.forEach(function (p) {
        items.push({ cardId: cardId, lotId: p.lotId, qty: p.qty, sellPrice: sellPrice, costPerUnit: p.costPerUnit });
      });
    });
    var order = {
      id: uid('ord'),
      date: input.date || todayISO(),
      channel: input.channel || 'tructiep',
      items: items,
      fees: Math.round(Number(input.fees) || 0),
      shippingFee: Math.round(Number(input.shippingFee) || 0),
      buyer: input.buyer || '',
      note: input.note || '',
      createdAt: new Date().toISOString()
    };
    state.orders.push(order);
    return order;
  }

  // ---------- dashboard aggregates ----------
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

  // 8 tuần gần nhất (mỗi bucket 7 ngày, kết thúc hôm nay). Trả về [{label, revenue, profit}]
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
    // card còn hàng nhưng lô cũ nhất nhập đã lâu, sắp xếp theo ngày nhập cũ nhất
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

  // ---------- bộ sưu tập theo set ----------
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

  // ---------- set tự tạo (custom sets) ----------
  function customUid() {
    return 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

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

  function createCustomSet(state, input) {
    var v = validateCustomSet(input);
    var s = { id: customUid(), name: v.name, total: v.total, official: v.official,
      year: v.year, note: v.note, createdAt: new Date().toISOString() };
    state.customSets.push(s);
    return s;
  }

  function updateCustomSet(state, id, input) {
    var s = getCustomSet(state, id);
    if (!s) throw new Error('Không tìm thấy set.');
    var v = validateCustomSet(input);
    s.name = v.name; s.total = v.total; s.official = v.official; s.year = v.year; s.note = v.note;
    return s;
  }

  function cardsOfCustomSet(state, id) {
    return state.cards.filter(function (c) { return c.setId === id; });
  }

  // Xóa set tự tạo: các card đang gắn sẽ bị gỡ khỏi set (setId=null). Trả về số card bị dời.
  function deleteCustomSet(state, id) {
    var moved = 0;
    state.cards.forEach(function (c) {
      if (c.setId === id) { c.setId = null; c.set = ''; moved++; }
    });
    state.customSets = state.customSets.filter(function (s) { return s.id !== id; });
    return moved;
  }

  // Phân giải thông tin set của card. Thứ tự: custom set theo id → db theo setId →
  // → user tự nhập (state.setTotals) → null (chưa rõ).
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

  // Gom card theo set (key chuẩn = set id trong db nếu phân giải được)
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

  function setManualTotal(state, key, total) {
    total = Math.floor(Number(total));
    if (!(total > 0)) throw new Error('Tổng số lá phải lớn hơn 0.');
    state.setTotals[key] = total;
  }

  function yearGroups(state) {
    // Gom setGroups theo năm phát hành (mới → cũ), set không rõ năm vào cuối
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

  var BCT = {
    STORAGE_KEY: STORAGE_KEY,
    CHANNELS: CHANNELS,
    CONDITIONS: CONDITIONS,
    RARITIES: RARITIES,
    VARIANTS: VARIANTS,
    uid: uid, fmtVND: fmtVND, fmtDate: fmtDate, todayISO: todayISO, esc: esc,
    blankState: blankState, load: load, save: save, wipe: wipe,
    previewFIFO: previewFIFO, consumeFIFO: consumeFIFO, lotsSorted: lotsSorted,
    getCard: getCard, stockOf: stockOf, avgCostOf: avgCostOf, cardByName: cardByName,
    variantBreakdown: variantBreakdown,
    orderRevenue: orderRevenue, orderCost: orderCost, orderProfit: orderProfit, orderQty: orderQty,
    createOrder: createOrder,
    totals: totals, weeklySeries: weeklySeries, topSellers: topSellers,
    slowMovers: slowMovers, lowStock: lowStock,
    priceHistory: priceHistory, ordersOfCard: ordersOfCard,
    parseCardNumber: parseCardNumber, resolveSet: resolveSet, isSecretCard: isSecretCard,
    setGroups: setGroups, setProgress: setProgress, setManualTotal: setManualTotal,
    yearGroups: yearGroups,
    getCustomSet: getCustomSet, customSetByName: customSetByName,
    createCustomSet: createCustomSet, updateCustomSet: updateCustomSet,
    deleteCustomSet: deleteCustomSet, cardsOfCustomSet: cardsOfCustomSet
  };

  root.BCT = BCT;
  if (typeof module !== 'undefined' && module.exports) module.exports = BCT;
})(typeof window !== 'undefined' ? window : globalThis);
