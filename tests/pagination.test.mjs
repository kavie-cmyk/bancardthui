// Chứng minh load() nạp ĐỦ dữ liệu khi một bảng vượt 1.000 dòng
// (Supabase/PostgREST cắt ở 1.000 dòng mỗi truy vấn nếu không phân trang).
// SB.q giả lập đúng hành vi máy chủ: tôn trọng limit/offset nhưng không
// bao giờ trả quá 1.000 dòng một lần.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function rows(n, make) {
  return Array.from({ length: n }, (_, i) => make(i));
}
const DATA = {
  cards: rows(2500, i => ({
    id: 'card-' + i, name: 'Card ' + i, set: 'Set', set_id: 'swsh7', number: String(i),
    rarity: 'Common', condition: 'A', language: 'en', created_at: '2026-01-01T00:00:00Z'
  })),
  inventory_lots: rows(2500, i => ({
    id: 'lot-' + i, card_id: 'card-' + (i % 2500), qty: 2, qty_remaining: 2,
    cost_per_unit: 1000, import_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z'
  })),
  orders: rows(1200, i => ({
    id: 'ord-' + i, date: '2026-01-01', channel: 'tructiep', items: [], fees: 0,
    shipping_fee: 0, buyer: '', note: '', status: 'done', created_at: '2026-01-01T00:00:00Z'
  })),
  card_images: [],
  custom_sets: [],
  set_totals: rows(3, i => ({ set_key: 'set-' + i, total: 100 + i })),
  listings: rows(1500, i => ({
    id: 'lst-' + i, card_id: 'card-' + (i % 2500), lot_id: null, price: 1000, qty: 1,
    status: 'draft', channel: '', created_at: '2026-01-01T00:00:00Z'
  })),
  store_orders: rows(1100, i => ({
    id: '00000000-0000-0000-0000-' + String(i).padStart(12, '0'), customer_name: 'Khach ' + i,
    phone: '0900000000', address: 'Dia chi', note: '', items: [], total: 0,
    shipping_fee: 0, status: 'new', converted_order_id: null, created_at: '2026-01-01T00:00:00Z'
  }))
};

function context() {
  const c = vm.createContext({
    console, setTimeout: () => 1, clearTimeout() {},
    SB: {
      q: async (table, opts = {}) => {
        const all = DATA[table] || [];
        const limit = Math.min(opts.limit != null ? opts.limit : 1000, 1000); // trần máy chủ
        const offset = opts.offset || 0;
        return all.slice(offset, offset + limit);
      },
      ins: async () => [], upd: async () => []
    }
  });
  c.window = c;
  for (const file of ['sets-db', 'store']) vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), c);
  return c;
}

test('load() paginates past the 1000-row server cap on every table', async () => {
  const { BCT } = context();
  const state = await BCT.load();
  assert.equal(state.cards.length, 2500);
  assert.equal(state.lots.length, 2500);
  assert.equal(state.orders.length, 1200);
  assert.equal(state.listings.length, 1500);
  assert.equal(state.storeOrders.length, 1100);
  assert.equal(Object.keys(state.setTotals).length, 3);
  // Không trùng dòng khi lật trang (khóa phụ id bảo đảm thứ tự ổn định ở máy chủ;
  // ở đây kiểm tra tập id là duy nhất).
  assert.equal(new Set(state.cards.map(x => x.id)).size, 2500);
});
