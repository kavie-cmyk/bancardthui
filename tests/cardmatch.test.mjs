// Test cho js/cardmatch.js (BCTMatch) — matcher dùng chung cho OCR scan +
// dictionary và ô tìm kiếm kho/storefront.
// Chạy: node tests/cardmatch.test.mjs  (in PASS/FAIL từng ca, exit != 0 khi fail)
// Tự nạp dictionary thật js/cards-dict.js nếu đã tồn tại; nếu chưa có thì dùng
// fixture nhỏ tự tạo trong file này (vẫn phải chạy xanh).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadInto(ctx, rel) {
  vm.runInContext(fs.readFileSync(path.join(rootDir, rel), 'utf8'), ctx, { filename: rel });
}

// Nạp cardmatch.js kiểu browser (global) giống các test *.test.mjs sẵn có.
const ctx = vm.createContext({ console });
ctx.window = ctx;
ctx.module = { exports: {} };
loadInto(ctx, 'js/cardmatch.js');
const M = ctx.BCTMatch;
assert.ok(M, 'thiếu global BCTMatch sau khi nạp js/cardmatch.js');

// --- dictionary thật (nếu đã có) ---
let realDict = null;
const dictPath = path.join(rootDir, 'js/cards-dict.js');
if (fs.existsSync(dictPath)) {
  try {
    loadInto(ctx, 'js/cards-dict.js');
    const names = ['BCT_CARDS_DICT', 'BCT_DICT', 'CARDS_DICT', 'BCTCardsDict', 'BCT_CARDS', 'cardsDict'];
    for (const n of names) {
      const v = ctx[n];
      if (v && typeof v === 'object' && v.sets && Array.isArray(v.cards)) { realDict = v; break; }
    }
    if (!realDict) {
      for (const k of Object.keys(ctx)) {
        const v = ctx[k];
        if (v && typeof v === 'object' && v.sets && Array.isArray(v.cards) && v.cards.length) { realDict = v; break; }
      }
    }
    if (!realDict && ctx.module && ctx.module.exports && ctx.module.exports.sets && Array.isArray(ctx.module.exports.cards)) {
      realDict = ctx.module.exports;
    }
  } catch (e) {
    console.log('WARN nạp js/cards-dict.js lỗi, bỏ qua dict thật: ' + e.message);
    realDict = null;
  }
}
console.log(realDict
  ? `Dict thật: js/cards-dict.js (${realDict.cards.length} lá) — chạy thêm ca kiểm chứng trên dict thật.`
  : 'Dict thật: chưa có js/cards-dict.js — dùng fixture trong test.');

// --- fixture nhỏ (đủ các ca bắt buộc, gồm lá Nhật メタモン s12a 117) ---
const FIXTURE = {
  sets: {
    base1: ['Base Set', '基本拡張パック'],
    cel25: ['Celebrations', '25th Anniversary Collection'],
    sv08: ['Surging Sparks', '超電ブレイカー'],
    sm10: ['Unbroken Bonds', 'ダブルブレイズ'],
    s12a: ['VSTAR Universe', 'VSTARユニバース'],
    SV8: ['Super Electric Breaker', '超電ブレイカー']
  },
  cards: [
    ['Pikachu', 'base1', '58', 0],
    ['Pikachu', 'cel25', '25', 0],
    ['Pikachu ex', 'sv08', '57', 0],
    ['Charizard', 'base1', '4', 0],
    ['Bulbasaur', 'base1', '44', 0],
    ['Spritzee', 'sm10', '141', 0],
    ['Latios', 'sv08', '077', 0],
    ['メタモン', 's12a', '117', 1],
    ['ピカチュウ', 's12a', '25', 1],
    ['ピカチュウex', 'SV8', '033', 1],
    ['ピカチュウex', 'SV8', '136', 1]
  ]
};
const index = M.buildIndex(FIXTURE);

// --- harness PASS/FAIL từng ca ---
let pass = 0, fail = 0;
function check(name, fn) {
  try {
    fn();
    pass++;
    console.log('PASS ' + name);
  } catch (e) {
    fail++;
    console.log('FAIL ' + name + ' — ' + (e && e.message ? e.message : e));
  }
}

// ---------- normName ----------
check('normName: bỏ dấu tiếng Việt + gọt ký tự lạ + gộp khoảng trắng', () => {
  assert.equal(M.normName('Pokémon Đặc Biệt!'), 'pokemon dac biet');
  assert.equal(M.normName('  Pikachu   ex  '), 'pikachu ex');
  assert.equal(M.normName('Mr. Mime'), 'mr mime');
  assert.equal(M.normName('Poké Ball'), 'poke ball');
  assert.equal(M.normName('Thẻ—Đặc_Biệt #1'), 'the dac biet 1');
});

check('normName: giữ nguyên ký tự Nhật', () => {
  assert.equal(M.normName('メタモン'), 'メタモン');
  assert.equal(M.normName('ピカチュウ'), 'ピカチュウ');
});

// ---------- fixNumber ----------
check('fixNumber: "O77"→"077", "l41"→"141"', () => {
  assert.equal(M.fixNumber('O77'), '077');
  assert.equal(M.fixNumber('l41'), '141');
  assert.equal(M.fixNumber('1O2'), '102');
});

check('fixNumber: "S" trong ngữ cảnh số → "5"; giữ nguyên dạng hợp lệ', () => {
  assert.equal(M.fixNumber('S'), '5');
  assert.equal(M.fixNumber('141'), '141');
  assert.equal(M.fixNumber('077'), '077');
  assert.equal(M.fixNumber('SV001'), 'SV001');
  assert.equal(M.fixNumber('141/102'), '141/102');
  assert.equal(M.fixNumber('TG05'), 'TG05');
});

// ---------- numKey ----------
check('numKey: "077" = "77", lấy phần trước "/", giữ tiền tố chữ', () => {
  assert.equal(M.numKey('077'), '77');
  assert.equal(M.numKey('77'), '77');
  assert.equal(M.numKey('141/102'), '141');
  assert.equal(M.numKey('TG05'), 'TG05');
  assert.equal(M.numKey('O77'), '77');
});

// ---------- parseQuery ----------
check('parseQuery: "sv08 226" và "226 sv08" tách đúng set + số', () => {
  // spread về realm của test: object từ VM context khác prototype, deepStrictEqual sẽ fail oan
  assert.deepEqual({ ...M.parseQuery('sv08 226') }, { text: '', setCode: 'sv08', number: '226' });
  assert.deepEqual({ ...M.parseQuery('226 sv08') }, { text: '', setCode: 'sv08', number: '226' });
});

check('parseQuery: "141" toàn số; "Pikachu 25" tách tên + số', () => {
  assert.deepEqual({ ...M.parseQuery('141') }, { text: '', setCode: null, number: '141' });
  assert.deepEqual({ ...M.parseQuery('Pikachu 25') }, { text: 'Pikachu', setCode: null, number: '25' });
  assert.deepEqual({ ...M.parseQuery('pikachu') }, { text: 'pikachu', setCode: null, number: null });
});

// ---------- buildIndex ----------
check('buildIndex: bản ghi + map theo numKey/setId', () => {
  assert.equal(index.records.length, FIXTURE.cards.length);
  const ditto = index.records.find(r => r.name === 'メタモン');
  assert.equal(ditto.setId, 's12a');
  assert.equal(ditto.number, '117');
  assert.equal(ditto.numKey, '117');
  assert.equal(ditto.lang, 'jp');
  assert.equal(ditto.norm, 'メタモン');
  assert.ok(index.byNumKey['117'].includes(ditto));
  assert.ok(index.bySet['s12a'].includes(ditto));
  assert.equal(index.byNumKey['77'][0].name, 'Latios'); // "077" chung khoá "77"
});

// ---------- searchDict ----------
check('searchDict: gõ sai "pikahu" vẫn có Pikachu trong top', () => {
  const res = M.searchDict(index, 'pikahu');
  assert.ok(res.length > 0, 'không có kết quả');
  assert.ok(res.some(r => r.name === 'Pikachu'), 'top không có Pikachu: ' + JSON.stringify(res));
  assert.equal(res[0].name, 'Pikachu');
});

check('searchDict: "Pikachu 25" khớp đúng lá Pikachu số 25', () => {
  const res = M.searchDict(index, 'Pikachu 25');
  assert.ok(res.length > 0);
  assert.equal(res[0].name, 'Pikachu');
  assert.equal(M.numKey(res[0].number), '25');
  assert.equal(res[0].setId, 'cel25');
});

check('searchDict: tên Nhật メタモン + số 117 → Ditto của VSTAR Universe (s12a)', () => {
  const res = M.searchDict(index, { name: 'メタモン', number: '117' });
  assert.ok(res.length > 0);
  assert.equal(res[0].name, 'メタモン');
  assert.equal(res[0].setId.toLowerCase(), 's12a');
  assert.equal(String(res[0].number), '117');
  assert.equal(res[0].lang, 'jp');
  assert.equal(res[0].setName, 'VSTARユニバース');
  const res2 = M.searchDict(index, 'メタモン 117');
  assert.ok(res2.length > 0 && res2[0].name === 'メタモン' && String(res2[0].number) === '117');
});

check('searchDict: OCR sai số "l17" + tên đúng vẫn lọt top ứng viên đúng', () => {
  const res = M.searchDict(index, { name: 'メタモン', number: 'l17' });
  assert.ok(res.length > 0);
  assert.equal(res[0].name, 'メタモン');
  assert.equal(String(res[0].number), '117');
});

check('searchDict: OCR sai cả tên + số ("Pikachv" + "O25") vẫn ra Pikachu 25', () => {
  const res = M.searchDict(index, { name: 'Pikachv', number: 'O25' });
  assert.ok(res.length > 0);
  assert.equal(res[0].name, 'Pikachu');
  assert.equal(M.numKey(res[0].number), '25');
});

check('searchDict: chỉ có số — "141" ra Spritzee, "77" ra Latios in "077"', () => {
  const r1 = M.searchDict(index, '141');
  assert.ok(r1.some(r => r.name === 'Spritzee' && String(r.number) === '141'));
  const r2 = M.searchDict(index, '77');
  assert.ok(r2.some(r => r.name === 'Latios' && String(r.number) === '077'));
});

check('searchDict: mã set + số "sv08 57" và opts limit/lang', () => {
  const res = M.searchDict(index, 'sv08 57');
  assert.ok(res.length > 0);
  assert.equal(res[0].setId, 'sv08');
  assert.equal(String(res[0].number), '57');
  assert.equal(M.searchDict(index, 'pikachu', { limit: 2 }).length, 2);
  const jp = M.searchDict(index, '117', { lang: 'jp' });
  assert.ok(jp.length > 0 && jp[0].lang === 'jp');
  assert.equal(M.searchDict(index, '').length, 0);
});

// ---------- dict thật (nếu có) ----------
if (realDict) {
  check('dict thật: buildIndex + tìm "pikahu" có Pikachu trong top', () => {
    const ridx = M.buildIndex(realDict);
    assert.ok(ridx.records.length >= realDict.cards.length - 5);
    const res = M.searchDict(ridx, 'pikahu');
    assert.ok(res.some(r => /pikachu/i.test(r.name)), 'không thấy Pikachu trong top dict thật');
  });
  check('dict thật: メタモン s12a 117 (bỏ qua nếu dict chưa có lá này)', () => {
    const exists = realDict.cards.some(r =>
      String(r[0]) === 'メタモン' && String(r[1]).toLowerCase() === 's12a' && String(r[2]) === '117');
    if (!exists) { console.log('  (dict thật chưa có メタモン s12a 117 — bỏ qua nội dung ca này)'); return; }
    const ridx = M.buildIndex(realDict);
    const res = M.searchDict(ridx, { name: 'メタモン', number: '117' });
    assert.ok(res.length > 0 && res[0].name === 'メタモン' && String(res[0].number) === '117');
  });
} else {
  check('dict thật: chưa có js/cards-dict.js → fixture fallback hoạt động', () => {
    assert.ok(FIXTURE.cards.length > 0 && index.records.length === FIXTURE.cards.length);
  });
}

// ---------- searchList ----------
const items = [
  { id: 1, name: 'Pikachu VMAX', set: 'Vivid Voltage', number: '44' },
  { id: 2, name: 'Pikachu', set: 'Base Set', number: '58' },
  { id: 3, name: 'Charizard', set: 'Base Set', number: '4' },
  { id: 4, name: 'Spritzee', set: 'Unbroken Bonds', number: '141' }
];
const fields = it => ({ name: it.name, set: it.set, number: it.number });

check('searchList: gõ sai 1 chữ vẫn ra item đúng', () => {
  const res = M.searchList(items, 'pikahu', fields);
  assert.ok(res.length > 0);
  assert.equal(res[0].id, 2);
  const res2 = M.searchList(items, 'charizrd', fields);
  assert.ok(res2.length > 0 && res2[0].id === 3);
});

check('searchList: khớp tuyệt đối xếp trước khớp prefix/fuzzy', () => {
  const res = M.searchList(items, 'Pikachu', fields);
  assert.equal(res[0].id, 2); // Pikachu tuyệt đối
  assert.equal(res[1].id, 1); // Pikachu VMAX chỉ prefix
});

check('searchList: tìm theo số + theo tên set; rỗng trả nguyên thứ tự; không đột biến mảng gốc', () => {
  assert.equal(M.searchList(items, '141', fields)[0].id, 4);
  const bySet = M.searchList(items, 'Base Set', fields);
  assert.deepEqual([...bySet.map(x => x.id)], [2, 3]); // spread: mảng từ VM context khác realm
  const before = items.map(x => x.id);
  const all = M.searchList(items, '', fields);
  assert.deepEqual([...all.map(x => x.id)], [1, 2, 3, 4]);
  assert.notEqual(all, items);
  M.searchList(items, 'Pikachu', fields);
  assert.deepEqual(items.map(x => x.id), before);
});

// ---------- Tích hợp OCR thật (bổ sung sau test E4: text thô vùng số in) ----------
check('fixNumber: trích "n/total" từ text OCR nhiễu nhiều token', () => {
  assert.equal(M.fixNumber('H / 0 ED 077/191'), '077/191');
  assert.equal(M.numKey(M.fixNumber('H / 0 ED 077/191')), '77');
  assert.equal(M.fixNumber('DS 4 / HKIYOTAKAOSHIYAM / 117/172'), '117/172');
  assert.equal(M.numKey(M.fixNumber('l17 / 172')), '117');
});

check('fixNumber: text nhiễu không có chữ số thật → "" (không gộp rác)', () => {
  assert.equal(M.fixNumber('ST / W / HMA'), '');
  assert.equal(M.fixNumber('Illus. Ken Sugimori'), '');
});

check('normName: nối token Nhật bị OCR tách (メタ モン → メタモン)', () => {
  assert.equal(M.normName('メタ モン'), 'メタモン');
  assert.equal(M.normName('Pikachu V'), 'pikachu v'); // tên Anh giữ nguyên khoảng trắng
});

check('searchDict: tên OCR dính nhiễu chứa trọn tên lá vẫn khớp (メタモン trong chuỗi rác)', () => {
  const res = M.searchDict(index, { name: 'を タン メタ モン SNIIIKNIIRINWNIWNIMW 中 庫 喘 商 和 Z', number: '117/172' }, { lang: 'jp', limit: 6 });
  assert.ok(res.length > 0, 'phải có ứng viên');
  assert.equal(res[0].name, 'メタモン');
  assert.equal(M.numKey(res[0].number), '117');
});

check('searchDict: số OCR trích đúng + tên Nhật → lá đúng vào top-1', () => {
  const number = M.fixNumber('DS 4 / HKIYOTAKAOSHIYAM / 117/172');
  const res = M.searchDict(index, { name: 'メタ モン', number }, { lang: 'jp', limit: 6 });
  assert.ok(res.length > 0, 'phải có ứng viên');
  assert.equal(M.numKey(res[0].number), '117');
  assert.equal(res[0].name, 'メタモン');
});

// ---------- Hồi quy OCR lá Nhật SV8: hậu tố ex bị OCR đọc thành rác ----------
// Ca thật đã đo trên ảnh sạch SV8-033: OCR tên đọc được token "ピカ チュ ウ"
// nhưng hậu tố "ex" thành ký tự rác và vùng tên lẫn nhiều dòng rác artwork;
// số in đọc "033/706" (tổng 106→706 sai nhưng numKey=33 đúng). Trước sửa:
// scoreName("ピカチュウex") = 0 → lá đúng bị cổng tên loại, "không có ứng viên".
const OCR_NAME_SV8_033 = 'ジン ピカ チュ ウ @② 々 め ワー - 志 23 し カチ .3 ング ENFIVEK ィング アー — ララ';

check('searchDict: ca1 OCR thật SV8-033 (tên rác + "033/706") → top có ピカチュウex SV8-033', () => {
  const res = M.searchDict(index, { name: OCR_NAME_SV8_033, number: '033/706' }, { lang: 'jp', limit: 6 });
  assert.ok(res.length > 0, 'phải có ứng viên');
  assert.ok(res.some(r => r.name === 'ピカチュウex' && r.setId === 'SV8' && String(r.number) === '033'),
    'top không có ピカチュウex SV8-033: ' + JSON.stringify(res));
  assert.equal(res[0].name, 'ピカチュウex'); // trên fixture: lá duy nhất mang số 33
});

check('searchDict: tên gốc bỏ hậu tố — "ピカチュウ" (không hậu tố) vẫn ra ピカチュウex; "Pikachu ex" tách token khớp tuyệt đối', () => {
  const jp = M.searchDict(index, { name: 'ピカチュウ' }, { lang: 'jp', limit: 6 });
  assert.ok(jp.some(r => r.name === 'ピカチュウex' && r.setId === 'SV8'), 'thiếu ピカチュウex: ' + JSON.stringify(jp));
  const en = M.searchDict(index, { name: 'Pikachu ex', number: '57' });
  assert.ok(en.length > 0 && en[0].name === 'Pikachu ex' && String(en[0].number) === '57');
});

check('searchDict: ca2 số-only "136/706" + tên rác → ピカチュウex SV8-136 có trong ứng viên', () => {
  // Đường SỐ-ONLY (phần cardmatch của logic gộp đa chiến lược ở app.js —
  // app.js chạy thêm searchDict({number}) khi ứng viên tốt nhất < 130):
  const byNum = M.searchDict(index, { number: '136/706' }, { lang: 'jp', limit: 6 });
  assert.ok(byNum.some(r => r.name === 'ピカチュウex' && r.setId === 'SV8' && String(r.number) === '136'),
    'số-only thiếu SV8-136: ' + JSON.stringify(byNum));
  // Đường kết hợp với chính chuỗi tên rác của ca1 cũng phải chứa lá này:
  const combined = M.searchDict(index, { name: OCR_NAME_SV8_033, number: '136/706' }, { lang: 'jp', limit: 6 });
  assert.ok(combined.some(r => r.name === 'ピカチュウex' && r.setId === 'SV8' && String(r.number) === '136'),
    'kết hợp thiếu SV8-136: ' + JSON.stringify(combined));
});

check('searchDict: cổng tên không nới bừa — tên không liên quan + số 033 không lọt ピカチュウex SV8', () => {
  const res = M.searchDict(index, { name: 'Charizard', number: '033/706' }, { lang: 'jp', limit: 6 });
  assert.ok(!res.some(r => r.setId === 'SV8'), 'lá SV8 lọt dù tên không liên quan: ' + JSON.stringify(res));
  // Số khớp (57 = Pikachu ex) nhưng tên hoàn toàn không liên quan: cổng tên
  // phải vẫn loại Pikachu ex và fallback theo tên phải đưa Charizard lên top.
  const res2 = M.searchDict(index, { name: 'Charizard', number: '57' }, { limit: 6 });
  assert.ok(res2.length > 0 && res2[0].name === 'Charizard', 'top phải là Charizard: ' + JSON.stringify(res2));
  assert.ok(!res2.some(r => r.name === 'Pikachu ex'), 'Pikachu ex không được lọt khi tên không liên quan');
});

if (realDict) {
  check('dict thật: ca1 OCR SV8-033 → ピカチュウex SV8-033 nằm trong top ứng viên kết hợp', () => {
    const ridx = M.buildIndex(realDict);
    const res = M.searchDict(ridx, { name: OCR_NAME_SV8_033, number: '033/706' }, { lang: 'jp', limit: 6 });
    const rank = res.findIndex(r => r.name === 'ピカチュウex' && r.setId === 'SV8' && String(r.number) === '033');
    assert.ok(rank >= 0, 'không thấy SV8-033 trong top 6 dict thật: ' + JSON.stringify(res));
    console.log(`  (dict thật: SV8-033 hạng ${rank + 1}/${res.length}, score ${res[rank].score})`);
  });
  check('dict thật: ca2 số-only "136/706" có ピカチュウex SV8-136; kết hợp tên rác + 136 cũng có', () => {
    const ridx = M.buildIndex(realDict);
    // Dict thật có 14 lá JP mang số 136 → số-only cần limit rộng mới chứa hết;
    // đây là phần cardmatch của ca2, logic gộp/cắt top-6 nằm ở app.js.
    const byNum = M.searchDict(ridx, { number: '136/706' }, { lang: 'jp', limit: 20 });
    const rankNum = byNum.findIndex(r => r.name === 'ピカチュウex' && r.setId === 'SV8' && String(r.number) === '136');
    assert.ok(rankNum >= 0, 'số-only (limit 20) thiếu SV8-136');
    console.log(`  (dict thật: SV8-136 hạng ${rankNum + 1} ở đường số-only limit 20)`);
    const combined = M.searchDict(ridx, { name: OCR_NAME_SV8_033, number: '136/706' }, { lang: 'jp', limit: 6 });
    assert.ok(combined.some(r => r.name === 'ピカチュウex' && r.setId === 'SV8' && String(r.number) === '136'),
      'kết hợp thiếu SV8-136: ' + JSON.stringify(combined));
  });
}

// ---------- Node export ----------
check('Node: module.exports === BCTMatch (nạp qua require)', () => {
  const req = createRequire(import.meta.url);
  const M2 = req('../js/cardmatch.js');
  assert.equal(typeof M2.searchDict, 'function');
  assert.equal(M2, globalThis.BCTMatch);
});

console.log(`\ncardmatch: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
