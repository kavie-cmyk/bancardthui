/* Bán Card Thui — seed.js
 * Dữ liệu mẫu để xem dashboard "sống" ngay khi mở app.
 * Dùng đúng logic FIFO thật (BCT.createOrder) nên số liệu nhất quán 100%.
 */
(function (root) {
  'use strict';
  var BCT = root.BCT;

  // Ảnh placeholder: thẻ foil SVG sinh sẵn, encode dataURL (nhẹ, không cần mạng)
  function foilImage(name, hue) {
    var short = name.length > 18 ? name.slice(0, 17) + '…' : name;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">' +
      '<defs>' +
      '<linearGradient id="f" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + hue + ',45%,26%)"/>' +
      '<stop offset=".45" stop-color="hsl(' + (hue + 30) + ',55%,38%)"/>' +
      '<stop offset=".55" stop-color="hsl(' + (hue - 20) + ',50%,30%)"/>' +
      '<stop offset="1" stop-color="hsl(' + hue + ',40%,20%)"/>' +
      '</linearGradient>' +
      '<radialGradient id="g" cx=".5" cy=".38" r=".75">' +
      '<stop offset="0" stop-color="hsl(' + hue + ',70%,60%)" stop-opacity=".55"/>' +
      '<stop offset="1" stop-color="hsl(' + hue + ',70%,60%)" stop-opacity="0"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<rect width="300" height="420" rx="18" fill="url(#f)"/>' +
      '<rect width="300" height="420" rx="18" fill="url(#g)"/>' +
      '<rect x="14" y="14" width="272" height="392" rx="12" fill="none" stroke="rgba(245,214,123,.55)" stroke-width="2"/>' +
      '<circle cx="150" cy="150" r="62" fill="none" stroke="rgba(245,214,123,.7)" stroke-width="3"/>' +
      '<circle cx="150" cy="150" r="44" fill="none" stroke="rgba(245,214,123,.35)" stroke-width="1.5"/>' +
      '<path d="M150 88 v124 M88 150 h124" stroke="rgba(245,214,123,.5)" stroke-width="2"/>' +
      '<text x="150" y="268" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="#f5d67b">' + short.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>' +
      '<text x="150" y="296" text-anchor="middle" font-family="sans-serif" font-size="13" letter-spacing="4" fill="rgba(242,237,226,.65)">POKÉMON TCG</text>' +
      '<text x="150" y="368" text-anchor="middle" font-family="sans-serif" font-size="12" fill="rgba(242,237,226,.4)">ẢNH MẪU</text>' +
      '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function d(offsetDays) {
    var t = new Date();
    t.setDate(t.getDate() - offsetDays);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }

  function addCard(state, def) {
    var card = {
      id: BCT.uid('card'),
      name: def.name, set: def.set, setId: def.setId || null, number: def.number, rarity: def.rarity,
      condition: def.condition || 'NM',
      graded: def.graded || null,
      images: [foilImage(def.name, def.hue || 40)],
      note: def.note || '',
      createdAt: new Date().toISOString()
    };
    state.cards.push(card);
    (def.lots || []).forEach(function (l) {
      state.lots.push({
        id: BCT.uid('lot'),
        cardId: card.id,
        qty: l.qty, qtyRemaining: l.qty,
        costPerUnit: l.cost, importDate: l.date, source: l.source || '',
        condition: def.condition || 'NM',
        createdAt: new Date().toISOString()
      });
    });
    return card;
  }

  function sell(state, opts) {
    // opts: {date, channel, buyer, fees, shippingFee, note, lines:[{name, qty, sellPrice}]}
    var lines = opts.lines.map(function (ln) {
      var card = BCT.cardByName(state, ln.name);
      if (!card) throw new Error('Không tìm thấy card mẫu: ' + ln.name);
      return { cardId: card.id, qty: ln.qty, sellPrice: ln.sellPrice };
    });
    return BCT.createOrder(state, {
      date: opts.date, channel: opts.channel, buyer: opts.buyer,
      fees: opts.fees || 0, shippingFee: opts.shippingFee || 0,
      note: opts.note || '', lines: lines
    });
  }

  function buildSeed() {
    var state = BCT.blankState();

    addCard(state, { name: 'Charizard ex', set: '151', setId: 'sv03.5', number: '006', rarity: 'Special Illustration Rare', hue: 18, condition: 'NM',
      lots: [
        { qty: 5, cost: 900000, date: d(55), source: 'Nhóm Zalo TCG' },
        { qty: 3, cost: 1150000, date: d(19), source: 'Shop HN' }
      ]});
    addCard(state, { name: 'Pikachu VMAX', set: 'Vivid Voltage', setId: 'swsh4', number: '044', rarity: 'Hyper Rare', hue: 48, condition: 'NM',
      lots: [
        { qty: 10, cost: 120000, date: d(70), source: 'Chợ TCG' },
        { qty: 4, cost: 95000, date: d(14), source: 'Facebook' }
      ]});
    addCard(state, { name: 'Umbreon VMAX', set: 'Evolving Skies', setId: 'swsh7', number: '215', rarity: 'Special Illustration Rare', hue: 260, condition: 'NM',
      graded: { org: 'PSA', score: 10 },
      lots: [
        { qty: 2, cost: 2800000, date: d(77), source: 'Đấu giá eBay' },
        { qty: 1, cost: 3100000, date: d(32), source: 'Collector SG' }
      ]});
    addCard(state, { name: 'Gengar ex', set: '151', setId: 'sv03.5', number: '094', rarity: 'Double Rare', hue: 280, condition: 'NM',
      lots: [
        { qty: 8, cost: 45000, date: d(42), source: 'Shop HN' },
        { qty: 6, cost: 38000, date: d(9), source: 'Chợ TCG' }
      ]});
    addCard(state, { name: 'Mew ex', set: '151', setId: 'sv03.5', number: '151', rarity: 'Special Illustration Rare', hue: 300, condition: 'LP',
      lots: [{ qty: 3, cost: 650000, date: d(60), source: 'Nhóm Zalo TCG' }] });
    addCard(state, { name: 'Rayquaza VMAX', set: 'Evolving Skies', setId: 'swsh7', number: '111', rarity: 'Ultra Rare', hue: 140, condition: 'NM',
      lots: [
        { qty: 6, cost: 150000, date: d(85), source: 'Chợ TCG' },
        { qty: 4, cost: 180000, date: d(47), source: 'Facebook' }
      ]});
    // Ví dụ điển hình: cùng 1 card, nhập 10k rồi 20k
    addCard(state, { name: 'Eevee', set: 'SWSH Promo', setId: 'swshp', number: 'SWSH230', rarity: 'Promo', hue: 32, condition: 'NM',
      note: 'Promo Eevee — nhập 2 đợt giá khác nhau',
      lots: [
        { qty: 20, cost: 10000, date: d(26), source: 'Chợ TCG' },
        { qty: 15, cost: 20000, date: d(6), source: 'Shop HN' }
      ]});
    addCard(state, { name: 'Lugia V', set: 'Silver Tempest', setId: 'swsh12', number: '138', rarity: 'Ultra Rare', hue: 200, condition: 'NM',
      lots: [{ qty: 4, cost: 220000, date: d(65), source: 'Đấu giá eBay' }] });

    // ~10 đơn trong 8 tuần qua, đủ 4 kênh
    sell(state, { date: d(53), channel: 'shopee', buyer: 'Minh', fees: 25000, shippingFee: 22000, lines: [
      { name: 'Eevee', qty: 5, sellPrice: 18000 }, { name: 'Pikachu VMAX', qty: 2, sellPrice: 160000 } ]});
    sell(state, { date: d(47), channel: 'facebook', buyer: 'Anh Tuấn', shippingFee: 15000, lines: [
      { name: 'Gengar ex', qty: 3, sellPrice: 60000 } ]});
    sell(state, { date: d(41), channel: 'tructiep', buyer: 'Chị Lan', lines: [
      { name: 'Rayquaza VMAX', qty: 1, sellPrice: 220000 } ]});
    sell(state, { date: d(34), channel: 'ebay', buyer: 'collector_jp', fees: 360000, shippingFee: 180000, lines: [
      { name: 'Umbreon VMAX', qty: 1, sellPrice: 3600000 } ]});
    sell(state, { date: d(28), channel: 'shopee', buyer: 'Khoa', fees: 30000, shippingFee: 22000, lines: [
      { name: 'Pikachu VMAX', qty: 3, sellPrice: 140000 }, { name: 'Eevee', qty: 8, sellPrice: 22000 } ]});
    sell(state, { date: d(20), channel: 'facebook', buyer: 'Huy', shippingFee: 20000, lines: [
      { name: 'Mew ex', qty: 1, sellPrice: 850000 } ]});
    sell(state, { date: d(15), channel: 'tructiep', buyer: 'Đạt', lines: [
      { name: 'Charizard ex', qty: 1, sellPrice: 1300000 } ]});
    sell(state, { date: d(10), channel: 'shopee', buyer: 'Phương', fees: 20000, shippingFee: 22000, lines: [
      { name: 'Gengar ex', qty: 4, sellPrice: 55000 }, { name: 'Lugia V', qty: 1, sellPrice: 280000 } ]});
    sell(state, { date: d(5), channel: 'facebook', buyer: 'Bình', shippingFee: 15000, lines: [
      { name: 'Eevee', qty: 6, sellPrice: 25000 } ]});
    sell(state, { date: d(2), channel: 'ebay', buyer: 'tcg_sg', fees: 65000, shippingFee: 120000, lines: [
      { name: 'Rayquaza VMAX', qty: 2, sellPrice: 260000 } ]});

    state.isSeeded = true;
    state.createdAt = new Date().toISOString();
    return state;
  }

  root.BCT_SEED = { buildSeed: buildSeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BCT_SEED;
})(typeof window !== 'undefined' ? window : globalThis);
