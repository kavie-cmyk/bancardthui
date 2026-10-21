import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function context() {
  const writes = [];
  const c = vm.createContext({ console, setTimeout: () => 1, clearTimeout() {},
    SB: {
      ins: async (table, rows) => { writes.push({ table, rows }); return rows.map((r, i) => ({ id: 'new-' + writes.length + '-' + i, ...r })); },
      upd: async (table, row, where) => { writes.push({ table, row, where }); return [row]; }
    }
  });
  c.window = c;
  for (const file of ['sets-db', 'store']) vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), c);
  c.writes = writes;
  return c;
}
function response(card = {}) {
  return { detections: [{ confidence: 'High', card: { name: 'Test card', number: '22', setName: 'Checklist', releaseName: 'Uncatalogued Japanese Release', fields: [{ key: 'CARD_LANGUAGE', value: 'ja' }], ...card } }] };
}
function appContext() {
  const c = context();
  const nodes = {};
  c.document = { getElementById: id => nodes[id] || null, querySelectorAll: () => [] };
  c.addEventListener = () => {};
  c.location = { hash: '' };
  const source = fs.readFileSync('js/app.js', 'utf8').replace('  boot();', `
    S = BCT.blankState();
    window.testApp = { scanConfirmHTML, holoInput, bindScanForm, vNhap, vCardEdit, state: S,
      setScan: function (r) { scanState = { result: r, photo: '' }; } };
  `);
  vm.runInContext(source, c);
  c.nodes = nodes;
  return c;
}

test('regression: unknown Japanese release never falls back to Checklist', () => {
  const { BCT } = context();
  const parsed = BCT.parseCardSightResult(response());
  assert.equal(parsed.language, 'jp');
  assert.equal(parsed.setName, 'Uncatalogued Japanese Release');
  assert.equal(parsed.number, '022');
  assert.equal(BCT.scanSetChoice(BCT.blankState(), parsed).name, parsed.releaseName);
  assert.equal(parsed.sourceSetName, 'Checklist');
});

test('missing release leaves set unresolved; data boundary rejects generic labels', async () => {
  const c = context();
  const parsed = c.BCT.parseCardSightResult(response({ releaseName: '' }));
  assert.equal(parsed.setName, '');
  assert.equal(c.BCT.scanSetChoice(c.BCT.blankState(), parsed).name, '');
  await assert.rejects(c.BCT.addCard(c.BCT.blankState(), { name: 'Test', set: ' Checklist ' }), /Checklist/);
  await assert.rejects(c.BCT.updateCard(c.BCT.blankState(), 'id', { set: 'Base Checklist' }), /Checklist/);
  assert.equal(c.writes.length, 0);
  assert.equal(c.BCT.isGenericSetName('Base Set'), false);
});

test('Japanese catalog accepts exact names/codes, isolates English IDs and counts', () => {
  const { BCT, BCT_SETS: db } = context();
  const parsed = BCT.parseCardSightResult(response({ releaseName: 'ニンジャスピナー', setId: 'uuid-from-cardsight' }));
  const choice = BCT.scanSetChoice(BCT.blankState(), parsed);
  assert.equal(choice.match.id, 'M4');
  assert.equal(db.byName('sv2a', 'jp').id, 'SV2a');
  assert.equal(db.byName('151', 'jp'), null);
  assert.equal(db.byName('Surging Sparks', 'jp'), null);
  const state = BCT.blankState();
  state.cards = [ { id: 'en', language: 'en', setId: 'neo1' }, { id: 'jp', language: 'jp', setId: 'neo1' } ];
  const groups = BCT.setGroups(state);
  assert.equal(groups.length, 2);
  assert.equal(BCT.resolveSet(state, 'ja:neo1').name, db.byId('neo1', 'jp').name);
  assert.equal(BCT.resolveSet(state, state.cards[1]).total, db.byId('neo1', 'jp').total);
  assert.equal(BCT.scanSetChoice(state, { language: 'jp', setName: '151' }).match, null);
});

test('language labels supported; missing language stays unknown', () => {
  const { BCT } = context();
  for (const value of ['ja', 'jp', 'Japanese', 'ja-JP', '日本語']) {
    assert.equal(BCT.parseCardSightResult(response({ fields: [{ key: 'CARD_LANGUAGE', value }] })).language, 'jp');
  }
  assert.equal(BCT.parseCardSightResult(response({ fields: [] })).language, '');
  assert.equal(BCT.parseCardSightResult({ detections: [] }), null);
});

test('parallel suggestions require sole High result; non-holo is not classified Holo', () => {
  const { BCT } = context();
  const parse = parallelSuggestions => BCT.parseCardSightResult(response({ parallelSuggestions }));
  assert.equal(parse([{ name: 'Holo' }]).variant, '');
  assert.equal(parse([{ name: 'Holo', confidence: 'Low' }]).variant, '');
  assert.equal(parse([{ name: 'Holo', confidence: 'High' }, { name: 'Reverse Holo', confidence: 'High' }]).variant, '');
  assert.equal(parse([{ name: 'Non-Holo', confidence: 'High' }]).variant, 'Normal');
  for (const [name, pattern, variant] of [
    ['Pokeball Reverse Holo', 'Poké Ball', 'Reverse Holo'],
    ['Master Ball', 'Master Ball', 'Reverse Holo'],
    ['Cosmos Swirl Holo', 'Cosmos Swirl', 'Holo'],
    ['Galaxy Holofoil', 'Galaxy', 'Holo'],
    ['Cracked Ice', 'Cracked Ice', 'Holo']
  ]) {
    const result = parse([{ name, confidence: 'High' }]);
    assert.equal(result.variant, variant);
    assert.equal(result.holoPattern, pattern);
  }
});

test('scanning does not merge English and Japanese cards or conflicting set IDs', () => {
  const { BCT } = context();
  const card = { name: 'Pikachu', number: '049', set: 'Same title', setId: 'set1', language: 'en' };
  assert.equal(BCT.sameCardIdentity(card, { ...card, language: 'jp' }), false);
  assert.equal(BCT.sameCardIdentity(card, { ...card, setId: 'set2' }), false);
  assert.equal(BCT.sameCardIdentity(card, { ...card, number: '49/203' }), true);
});

test('custom holo survives insert/edit; UI keeps uncommon values and offers editable suggestions', async () => {
  const c = appContext(), state = c.testApp.state;
  const pattern = 'My custom foil <A>';
  const lot = await c.BCT.addLot(state, { cardId: 'test', qty: 1, costPerUnit: 0, variant: 'Holo', holoPattern: pattern });
  assert.equal(lot.holoPattern, pattern);
  await c.BCT.updateLot(state, lot.id, { holoPattern: 'New finish' });
  assert.equal(state.lots[0].holoPattern, 'New finish');
  const html = c.testApp.holoInput('test-holo', pattern);
  assert.match(html, /value="My custom foil &lt;A&gt;"/);
  assert.match(html, /New finish/);
  assert.match(html, /Galaxy/);
  const prefill = c.testApp.vNhap({ newcard: '1', setkey: 'ja:SV2a' });
  assert.match(prefill, /value="jp" selected/);
});

test('scan form shows real set and Japanese image; unknown finish requires confirmation', () => {
  const c = appContext();
  const parsed = c.BCT.parseCardSightResult(response({ releaseName: 'ニンジャスピナー', fields: [{key:'CARD_LANGUAGE',value:'ja'}, {key:'Rarity',value:'SAR'}] }));
  const html = c.testApp.scanConfirmHTML(parsed);
  assert.match(html, /id="s-setname" required[^>]*value="ニンジャスピナー"/);
  assert.match(html, /\/ja\/M\/M4\/022\//);
  assert.match(html, /id="s-holo"/);
  assert.match(html, /value="SAR" selected/);
  c.testApp.state.cards.push({id:'sar',name:'Test',rarity:'SAR',language:'jp'});
  assert.match(c.testApp.vCardEdit('sar'), /<option selected>SAR<\/option>/);
  assert.match(html, /id="s-variant" required><option value="">/);
  assert.doesNotMatch(html, /value="Checklist"/);
});

test('scan submit writes selected custom holo, real set and Japanese language to backend', async () => {
  const c = appContext();
  let submit;
  c.nodes['f-scan'] = { addEventListener: (name, cb) => { submit = cb; } };
  c.nodes['toast'] = { classList: { add() {}, remove() {} } };
  const values = { 's-name': 'Test card', 's-setname': 'ニンジャスピナー', 's-lang': 'jp', 's-number': '022',
    's-variant': 'Reverse Holo', 's-holo': 'Custom mirror', 's-qty': '1', 's-cost': '0', 's-rarity': '', 's-cond': 'A',
    's-date': '2026-10-21', 's-source': '', 's-usephoto': '0' };
  for (const [id, value] of Object.entries(values)) c.nodes[id] = { value, addEventListener() {} };
  c.testApp.bindScanForm();
  submit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  const row = c.writes.find(w => w.table === 'cards').rows[0];
  assert.equal(row.set_id, 'M4');
  assert.equal(row.language, 'jp');
  const lot = c.writes.find(w => w.table === 'inventory_lots').rows[0];
  assert.equal(lot.holo_pattern, 'Custom mirror');
  assert.equal(lot.variant, 'Reverse Holo');
});
