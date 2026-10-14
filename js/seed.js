/* Bán Card Thui — seed.js (Supabase)
 * Dữ liệu mẫu: 9 card (8 EN + 1 JP) + ~10 đơn trong 8 tuần qua.
 * Chạy qua đúng logic ghi DB thật (addCard/addLot/createOrder) nên số liệu nhất quán.
 * Ảnh: KHÔNG seed ảnh — ảnh chính thức tự lấy từ TCGdex CDN theo setId + số thứ tự.
 */
(function (root) {
  'use strict';

  function d(offsetDays) {
    var t = new Date();
    t.setDate(t.getDate() - offsetDays);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }

  var CARDS = [
    { name: 'Charizard ex', set: '151', storageLocation: 'Binder 1 - trang 3', setId: 'sv03.5', number: '006', rarity: 'Special Illustration Rare', language: 'en', condition: 'A',
      lots: [
        { qty: 5, cost: 900000, date: d(55), source: 'Nhóm Zalo TCG', variant: 'Holo', holoPattern: 'Cosmos Swirl' },
        { qty: 3, cost: 1150000, date: d(19), source: 'Shop HN', variant: 'Normal' }
      ]},
    { name: 'Pikachu VMAX', set: 'Vivid Voltage', setId: 'swsh4', number: '044', rarity: 'Hyper Rare', language: 'en', condition: 'A',
      lots: [
        { qty: 10, cost: 120000, date: d(70), source: 'Chợ TCG', variant: 'Reverse Holo', holoPattern: 'Cosmos' },
        { qty: 4, cost: 95000, date: d(14), source: 'Facebook', variant: 'Holo' }
      ]},
    { name: 'Umbreon VMAX', set: 'Evolving Skies', setId: 'swsh7', number: '215', rarity: 'Special Illustration Rare', language: 'en', condition: 'A',
      graded: { org: 'PSA', score: '10' },
      lots: [
        { qty: 2, cost: 2800000, date: d(77), source: 'Đấu giá eBay', variant: 'Holo' },
        { qty: 1, cost: 3100000, date: d(32), source: 'Collector SG', variant: 'Holo' }
      ]},
    { name: 'Gengar ex', set: '151', setId: 'sv03.5', number: '094', rarity: 'Double Rare', language: 'en', condition: 'A',
      lots: [
        { qty: 8, cost: 45000, date: d(42), source: 'Shop HN', variant: 'Reverse Holo', holoPattern: 'Poké Ball' },
        { qty: 6, cost: 38000, date: d(9), source: 'Chợ TCG', variant: 'Normal' }
      ]},
    { name: 'Mew ex', set: '151', setId: 'sv03.5', number: '151', rarity: 'Special Illustration Rare', language: 'en', condition: 'C',
      lots: [{ qty: 3, cost: 650000, date: d(60), source: 'Nhóm Zalo TCG', variant: 'Holo' }] },
    { name: 'Rayquaza VMAX', set: 'Evolving Skies', setId: 'swsh7', number: '111', rarity: 'Ultra Rare', language: 'en', condition: 'A',
      lots: [
        { qty: 6, cost: 150000, date: d(85), source: 'Chợ TCG', variant: 'Normal' },
        { qty: 4, cost: 180000, date: d(47), source: 'Facebook', variant: 'Reverse Holo' }
      ]},
    // Ví dụ điển hình: cùng 1 card, nhập 10k rồi 20k
    { name: 'Eevee', set: 'SWSH Promo', setId: 'swshp', number: 'SWSH230', rarity: 'Promo', language: 'en', condition: 'A',
      note: 'Promo Eevee — nhập 2 đợt giá khác nhau', storageLocation: 'Hộp A3',
      lots: [
        { qty: 20, cost: 10000, date: d(26), source: 'Chợ TCG', variant: 'Normal' },
        { qty: 15, cost: 20000, date: d(6), source: 'Shop HN', variant: 'Reverse Holo', holoPattern: 'Master Ball' }
      ]},
    { name: 'Lugia V', set: 'Silver Tempest', setId: 'swsh12', number: '138', rarity: 'Ultra Rare', language: 'en', condition: 'A',
      lots: [{ qty: 4, cost: 220000, date: d(65), source: 'Đấu giá eBay', variant: 'Holo' }] },
    // Demo lá tiếng Nhật — ảnh tự lấy từ TCGdex CDN /ja/
    { name: 'Pikachu', set: '151 (Japanese)', setId: 'SV2a', number: '025', rarity: 'Common', language: 'jp', condition: 'A',
      note: 'Bản Nhật —ポケモンカード151',
      lots: [{ qty: 5, cost: 15000, date: d(12), source: 'Shop JP', variant: 'Normal' }] }
  ];

  var ORDERS = [
    { date: d(53), channel: 'shopee', buyer: 'Minh', fees: 25000, shippingFee: 22000, lines: [
      { name: 'Eevee', qty: 5, sellPrice: 18000 }, { name: 'Pikachu VMAX', qty: 2, sellPrice: 160000 } ]},
    { date: d(47), channel: 'facebook', buyer: 'Anh Tuấn', shippingFee: 15000, lines: [
      { name: 'Gengar ex', qty: 3, sellPrice: 60000 } ]},
    { date: d(41), channel: 'tructiep', buyer: 'Chị Lan', lines: [
      { name: 'Rayquaza VMAX', qty: 1, sellPrice: 220000 } ]},
    { date: d(34), channel: 'ebay', buyer: 'collector_jp', fees: 360000, shippingFee: 180000, lines: [
      { name: 'Umbreon VMAX', qty: 1, sellPrice: 3600000 } ]},
    { date: d(28), channel: 'shopee', buyer: 'Khoa', fees: 30000, shippingFee: 22000, lines: [
      { name: 'Pikachu VMAX', qty: 3, sellPrice: 140000 }, { name: 'Eevee', qty: 8, sellPrice: 22000 } ]},
    { date: d(20), channel: 'facebook', buyer: 'Huy', shippingFee: 20000, lines: [
      { name: 'Mew ex', qty: 1, sellPrice: 850000 } ]},
    { date: d(15), channel: 'tructiep', buyer: 'Đạt', lines: [
      { name: 'Charizard ex', qty: 1, sellPrice: 1300000 } ]},
    { date: d(10), channel: 'shopee', buyer: 'Phương', fees: 20000, shippingFee: 22000, lines: [
      { name: 'Gengar ex', qty: 4, sellPrice: 55000 }, { name: 'Lugia V', qty: 1, sellPrice: 280000 } ]},
    { date: d(5), channel: 'facebook', buyer: 'Bình', shippingFee: 15000, lines: [
      { name: 'Eevee', qty: 6, sellPrice: 25000 } ]},
    { date: d(2), channel: 'ebay', buyer: 'tcg_sg', fees: 65000, shippingFee: 120000, lines: [
      { name: 'Rayquaza VMAX', qty: 2, sellPrice: 260000 } ]}
  ];

  async function buildSeed(state) {
    var BCT = root.BCT;
    for (var i = 0; i < CARDS.length; i++) {
      var def = CARDS[i];
      var card = await BCT.addCard(state, {
        name: def.name, set: def.set, setId: def.setId, number: def.number,
        rarity: def.rarity, condition: def.condition || 'A',
        graded: def.graded || null, language: def.language || 'en',
        storageLocation: def.storageLocation || '',
        note: def.note || ''
      });
      for (var j = 0; j < def.lots.length; j++) {
        var l = def.lots[j];
        await BCT.addLot(state, {
          cardId: card.id, qty: l.qty, costPerUnit: l.cost, importDate: l.date,
          source: l.source || '', variant: l.variant || 'Normal',
          holoPattern: l.holoPattern || null, condition: def.condition || 'A'
        });
      }
    }
    for (var k = 0; k < ORDERS.length; k++) {
      var o = ORDERS[k];
      var lines = o.lines.map(function (ln) {
        var card = BCT.cardByName(state, ln.name);
        if (!card) throw new Error('Không tìm thấy card mẫu: ' + ln.name);
        return { cardId: card.id, qty: ln.qty, sellPrice: ln.sellPrice };
      });
      await BCT.createOrder(state, {
        date: o.date, channel: o.channel, buyer: o.buyer,
        fees: o.fees || 0, shippingFee: o.shippingFee || 0, note: '', lines: lines
      });
    }
    return state;
  }

  root.BCT_SEED = { buildSeed: buildSeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BCT_SEED;
})(typeof window !== 'undefined' ? window : globalThis);
