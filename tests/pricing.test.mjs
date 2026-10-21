import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../js/pricing.js';
const P = globalThis.BCTPricing;
const cm = { source: 'cardmarket', price: 1.79, currency: 'EUR', updated_at: '2026-10-20' };
const tp = { source: 'tcgplayer', price: 1.68, currency: 'USD', updated_at: '2026-10-14' };
const card = { id: 'sv08-226', localId: '226', name: 'Tatsugiri ex', set: { id: 'sv08' }, pricing: { cardmarket: { trend: 1.79 }, tcgplayer: null } };
const set = { id: 'sv08', name: 'Surging Sparks', abbreviation: { official: 'SSP' } };
const product = { productId: 590074, name: 'Tatsugiri ex - 226/191', extendedData: [{ name: 'Number', value: '226/191' }] };
function browser(fetcher, sb = {}) {
  const c = vm.createContext({ console, setTimeout, clearTimeout, AbortController, fetch: fetcher, SB: sb,
    SUPABASE_URL: 'https://project.test', SUPABASE_ANON_KEY: 'public-test-key' });
  vm.runInContext(fs.readFileSync('js/pricing.js', 'utf8'), c);
  vm.runInContext(fs.readFileSync('js/store.js', 'utf8'), c);
  return c;
}
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

test('numeric, padded, fractional and promo card identifiers retain exact identity', () => {
  assert.deepEqual(P.numberCandidates('049/203'), ['49', '049']);
  assert.deepEqual(P.numberCandidates('TG05'), ['TG05']);
  assert.deepEqual(P.ioSetIds('sv08'), ['sv8', 'sv08']);
  assert.deepEqual(P.ioSetIds('sv08.5'), ['sv8pt5', 'sv85', 'sv08.5']);
  assert.deepEqual(P.ioSetIds('swsh4.5'), ['swsh4pt5', 'swsh45', 'swsh4.5']);
});

test('parses alternate and older TCGplayer printings; rejects invalid prices', () => {
  for (const variant of ['holofoil', 'holo', 'normal', 'reverse', 'reverse-holofoil', 'reverseHolofoil', 'unlimited', '1stEditionHolofoil']) {
    assert.equal(P.fromTcgdex({ tcgplayer: { [variant]: { marketPrice: 2 } } })[0].price, 2);
  }
  assert.deepEqual(P.fromTcgdex({ cardmarket: { trend: 'bad', avg: null }, tcgplayer: { holofoil: { marketPrice: -1 } } }), []);
  assert.equal(P.fromTcgdex({ cardmarket: { trend: 0, avg: 2 } })[0].price, 2);
  assert.equal(P.fromIo({ tcgplayer: { prices: { unlimitedHolofoil: { market: 4 } } } })[0].price, 4);
});

test('matches exact set and collector number; refuses ambiguous products and Japanese 151', () => {
  assert.equal(P.selectGroup([{ groupId: 1, name: 'SV08: Surging Sparks', abbreviation: 'SSP' }], set).groupId, 1);
  assert.equal(P.selectGroup([{ groupId: 2, name: 'Pokemon Card 151 (Japanese)' }], { name: '151' }), null);
  assert.equal(P.selectProduct([product], '0226/191').productId, 590074);
  assert.equal(P.selectProduct([product], '227'), null);
  assert.equal(P.selectProduct([product, { ...product, productId: 999 }], '226'), null);
  assert.equal(P.selectProduct([{ productId: 1, extendedData: [] }], '226'), null);
});

test('CSV market prices are joined by productId and keep source date and variant', () => {
  const result = P.fromCsv([{ productId: 1, marketPrice: 900 }, { productId: 590074, marketPrice: 1.57, subTypeName: 'Holofoil' }], product, '2026-10-20');
  assert.equal(result[0].price, 1.57);
  assert.equal(result[0].updated_at, '2026-10-20');
  assert.equal(result[0].via, 'tcgcsv');
});

test('browser immediately uses proxy independent feed when TCGdex is missing TCGplayer', async () => {
  const calls = [];
  const c = browser(async (url) => {
    calls.push(url);
    if (url.includes('api.tcgdex')) return response(card);
    if (url.includes('/price-proxy')) {
      assert.ok(url.includes('missing=tcgplayer'));
      return response({ sources: [cm, tp], diag: 'TCGCSV' });
    }
    throw new Error('Unexpected per-card patch or locale retry: ' + url);
  });
  const rows = await c.BCT.fetchMarketPrices('sv08', '226', { language: 'en' });
  assert.equal(rows.length, 2);
  assert.equal(calls.length, 2);
});

test('proxy failure preserves available Cardmarket result', async () => {
  const c = browser(async (url) => url.includes('api.tcgdex') ? response(card) : response({}, 500));
  const rows = await c.BCT.fetchMarketPrices('sv08', '226', { language: 'en' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'cardmarket');
  assert.match(c.BCT.getLastPriceDiag().tries.join(' '), /HTTP 500/);
});

test('saving a partial refresh preserves old TCGplayer date and manual prices', async () => {
  let stored;
  const c = browser(async () => { throw new Error('not called'); }, { upd: async (_table, row) => { stored = row; } });
  const state = { cards: [{ id: 'c1', condition: 'A', priceSources: [cm, tp, { source: 'other', price: 3, currency: 'USD', kind: 'manual' }] }] };
  await c.BCT.saveMarketPrices(state, 'c1', [{ ...cm, price: 2 }]);
  assert.equal(stored.price_sources.length, 3);
  assert.equal(stored.price_sources.find(s => s.source === 'tcgplayer').updated_at, '2026-10-14');
  assert.equal(stored.price_sources.find(s => s.source === 'other').kind, 'manual');
  assert.equal(stored.price_sources.find(s => s.source === 'cardmarket').price, 2);
});

test('Japanese cards never request English prices or the English fallback', async () => {
  const calls = [];
  const c = browser(async url => { calls.push(url); return response({}, 404); });
  assert.equal(await c.BCT.fetchMarketPrices('SV2a', '025', { language: 'jp' }), null);
  assert.ok(calls.every(u => u.includes('/v2/ja/')));
});

globalThis.Deno = { env: { get: name => name === 'SUPABASE_URL' ? 'https://project.test' : 'server-test-key' }, serve() {} };
const { handler } = await import('../supabase/functions/price-proxy/index.ts');

test('server fallback works with missing primary data, caches entire set across requests, and keeps feed timestamp', async () => {
  const oldFetch = globalThis.fetch;
  const cache = new Map();
  let csvCalls = 0;
  const ioUrls = [];
  globalThis.fetch = async (url, opts = {}) => {
    url = String(url);
    if (url.includes('/rest/v1/price_feed_cache')) {
      if (opts.method === 'POST') { const row = JSON.parse(opts.body); cache.set(row.resource, row); return new Response(null, { status: 201 }); }
      const key = new URL(url).searchParams.get('resource').slice(3);
      return response(cache.has(key) ? [cache.get(key)] : []);
    }
    if (url.includes('tcgdex.net') && url.includes('/cards/')) return response(card);
    if (url.includes('tcgdex.net') && url.includes('/sets/')) return response(set);
    if (url.includes('tcgcsv.com')) {
      csvCalls++;
      assert.equal(opts.headers['User-Agent'], 'BanCardThui/2.0');
      if (url.endsWith('last-updated.txt')) return new Response('2026-10-20T20:05:18+0000');
      let results;
      if (url.endsWith('/groups')) results = [{ groupId: 23651, name: 'SV08: Surging Sparks', abbreviation: 'SSP' }];
      if (url.endsWith('/products')) results = [product];
      if (url.endsWith('/prices')) results = [{ productId: 590074, marketPrice: 1.57, subTypeName: 'Holofoil' }];
      return response({ success: true, results }, 200, { 'Last-Modified': 'Tue, 20 Oct 2026 20:03:12 GMT' });
    }
    if (url.includes('pokemontcg.io')) { ioUrls.push(url); return response({}, 500); }
    throw new Error('Unexpected URL: ' + url);
  };
  try {
    for (let i = 0; i < 2; i++) {
      const r = await handler(new Request('https://project.test/price-proxy?set=sv08&number=226&missing=tcgplayer'));
      const j = await r.json();
      assert.equal(j.sources.length, 2);
      const tcg = j.sources.find(s => s.source === 'tcgplayer');
      assert.equal(tcg.price, 1.57);
      assert.equal(tcg.updated_at, '2026-10-20T20:03:12.000Z');
    }
    assert.equal(csvCalls, 4); // build + groups + products + prices, only once
    assert.equal(ioUrls.length, 0);
    assert.equal(cache.size, 4);
  } finally { globalThis.fetch = oldFetch; }
});

test('server maps SV aliases for legacy fallback and isolates provider errors', async () => {
  const oldFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    url = String(url); urls.push(url);
    if (url.includes('/cards/') && url.includes('tcgdex')) return response(card);
    if (url.includes('/sets/')) return response({}, 500);
    if (url.includes('pokemontcg.io')) return response({ data: { set: { id: 'sv8' }, number: '226', tcgplayer: { prices: { holofoil: { market: 2 } } } } });
    throw new Error('unexpected');
  };
  try {
    const j = await (await handler(new Request('https://project.test/price-proxy?set=sv08&number=226'))).json();
    assert.equal(j.sources.length, 2);
    assert.ok(urls.some(u => u.includes('pokemontcg.io/v2/cards/sv8-226')));
  } finally { globalThis.fetch = oldFetch; }
});

test('server rejects malformed IDs and handles preflight without upstream calls', async () => {
  assert.equal((await handler(new Request('https://project.test/?set=../../x&number=1'))).status, 400);
  assert.equal((await handler(new Request('https://project.test/', { method: 'OPTIONS' }))).status, 200);
});
