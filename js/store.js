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

  // ---------- state ----------
  function blankState() {
    return { cards: [], lots: [], orders: [], isSeeded: false, createdAt: new Date().toISOString() };
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

  var BCT = {
    STORAGE_KEY: STORAGE_KEY,
    CHANNELS: CHANNELS,
    CONDITIONS: CONDITIONS,
    uid: uid, fmtVND: fmtVND, fmtDate: fmtDate, todayISO: todayISO, esc: esc,
    blankState: blankState, load: load, save: save, wipe: wipe,
    previewFIFO: previewFIFO, consumeFIFO: consumeFIFO, lotsSorted: lotsSorted,
    getCard: getCard, stockOf: stockOf, avgCostOf: avgCostOf, cardByName: cardByName,
    orderRevenue: orderRevenue, orderCost: orderCost, orderProfit: orderProfit, orderQty: orderQty,
    createOrder: createOrder,
    totals: totals, weeklySeries: weeklySeries, topSellers: topSellers,
    slowMovers: slowMovers, lowStock: lowStock,
    priceHistory: priceHistory, ordersOfCard: ordersOfCard
  };

  root.BCT = BCT;
  if (typeof module !== 'undefined' && module.exports) module.exports = BCT;
})(typeof window !== 'undefined' ? window : globalThis);
