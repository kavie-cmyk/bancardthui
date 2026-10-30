#!/usr/bin/env node
/*
 * Bán Card Thui — OCR LIVE TEST (E4): chạy pipeline OCR y hệt prototype trong app
 * (js/app.js: runOcrScan / ocrCropCanvas / OCR_NUMBER_WHITELIST) trên ảnh lá THẬT
 * tải từ TCGdex CDN, rồi tra dictionary thật (js/cards-dict.js + js/cardmatch.js)
 * và báo đúng/sai từng trường. Script này KHÔNG sửa code app, chỉ require để dùng.
 *
 * CÁCH CHẠY:
 *   # 1) Cài deps NGOÀI repo (đừng cài vào repo):
 *   mkdir -p ~/workspace/tools/ocr-live-test && cd ~/workspace/tools/ocr-live-test
 *   npm init -y && npm install tesseract.js@5 sharp
 *   # 2) Chạy từ thư mục repo:
 *   cd ~/workspace/bancardthui
 *   OCR_DEPS_DIR=~/workspace/tools/ocr-live-test node tests/ocr-live.mjs
 *
 * BIẾN MÔI TRƯỜNG:
 *   OCR_DEPS_DIR  thư mục đã `npm install tesseract.js sharp`
 *                 (mặc định: ~/workspace/tools/ocr-live-test)
 *   OCR_OUT       thư mục ghi ảnh tải về + crop + results.md / results.json
 *                 (mặc định: = OCR_DEPS_DIR)
 *   OCR_DEBUG=1   bật logger tiến trình của tesseract
 *
 * TIỀN XỬ LÝ ẢNH (sharp, tương đương ocrCropCanvas của app):
 *   app (canvas): drawImage crop + upscale 2x, rồi từng pixel:
 *     gray = 0.299*R + 0.587*G + 0.114*B ; v = (gray - 128) * 1.25 + 128, clamp 0..255.
 *   script này: sharp extract đúng tỉ lệ crop -> resize 2x -> lấy buffer raw ->
 *     áp NGUYÊN VĂN công thức trên cho từng pixel -> ghi PNG cho tesseract.
 *   Khác biệt duy nhất so với trình duyệt: kernel nội suy khi resize
 *     (sharp mặc định lanczos3, canvas dùng smoothing của trình duyệt).
 *
 * PIPELINE (khớp app.js):
 *   - Vùng tên: crop x 4%–75%, y 2%–13%. OCR 'eng' (lá EN / toggle Nhật TẮT)
 *     hoặc 'jpn+eng' (toggle "Lá Nhật" BẬT). Lá JA chạy CẢ HAI chế độ để so sánh.
 *   - Vùng số in: crop x 0%–30%, y 88%–100%. OCR 'eng' + tessedit_char_whitelist
 *     = OCR_NUMBER_WHITELIST, sau đó qua BCTMatch.fixNumber.
 *   - Tra cứu: BCTMatch.buildIndex(BCT_DICT) + searchDict(index,
 *     { name, number }, { lang: isJp ? 'jp' : undefined, limit: 6 }).
 *   - Từ bản ocr3 (khớp app.js): tên chỉ lấy DÒNG ĐẦU TIÊN có chữ của OCR
 *     vùng tên; nếu ứng viên tốt nhất < 130 thì gộp thêm đường SỐ-ONLY và
 *     TÊN-ONLY (khử trùng setId+number+name, sắp xếp lại theo score, tối đa 6).
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expandHome = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);
const DEPS_DIR = path.resolve(expandHome(process.env.OCR_DEPS_DIR || '~/workspace/tools/ocr-live-test'));
const OUT_DIR = path.resolve(expandHome(process.env.OCR_OUT || DEPS_DIR));
const IMG_DIR = path.join(OUT_DIR, 'images');
const CROP_DIR = path.join(OUT_DIR, 'crops');
fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(CROP_DIR, { recursive: true });

const depsRequire = createRequire(path.join(DEPS_DIR, 'ocr-live-test-deps.js'));
const repoRequire = createRequire(path.join(REPO_ROOT, 'js', 'cardmatch.js'));
const Tesseract = depsRequire('tesseract.js');
const sharp = depsRequire('sharp');
const BCTMatch = repoRequire('./cardmatch.js');
const BCT_DICT = repoRequire('./cards-dict.js');

// Giống hệt js/app.js dòng khai báo OCR_NUMBER_WHITELIST.
const OCR_NUMBER_WHITELIST = '0123456789/ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ---------------------------------------------------------------------------
// Crop + tiền xử lý: sao chép ocrCropCanvas(img, fx0, fy0, fx1, fy1) của app.
// ---------------------------------------------------------------------------
async function ocrCropBuffer(imgBuf, fx0, fy0, fx1, fy1, invert) {
  const meta = await sharp(imgBuf).metadata();
  const W = meta.width, H = meta.height;
  const sx = Math.max(0, Math.floor(W * fx0)), sy = Math.max(0, Math.floor(H * fy0));
  const sw = Math.max(1, Math.floor(W * (fx1 - fx0))), sh = Math.max(1, Math.floor(H * (fy1 - fy0)));
  const { data, info } = await sharp(imgBuf)
    .extract({ left: sx, top: sy, width: sw, height: sh })
    .resize(sw * 2, sh * 2)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += ch) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    let v = (gray - 128) * 1.25 + 128;
    v = v < 0 ? 0 : (v > 255 ? 255 : v);
    if (invert) v = 255 - v;
    px[i] = px[i + 1] = px[i + 2] = v;
    if (ch === 4) px[i + 3] = 255;
  }
  return sharp(px, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer();
}

// OCR 1 ảnh: mỗi lần tạo worker riêng (giống app gọi Tesseract.recognize riêng
// cho từng vùng với options riêng — tham số whitelist không rò sang lần khác).
async function ocrRecognizeText(pngBuf, lang, extraParams) {
  const wopts = { cachePath: path.join(OUT_DIR, 'tess-cache') };
  if (process.env.OCR_DEBUG) wopts.logger = (m) => console.error('[tess]', m.status, m.progress ?? '');
  const worker = await Tesseract.createWorker(lang, undefined, wopts);
  try {
    if (extraParams) await worker.setParameters(extraParams);
    const out = await worker.recognize(pngBuf);
    return (out && out.data && out.data.text) || '';
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Danh sách lá test. expect* = đáp án thật để chấm (tên / setId / số in).
// ---------------------------------------------------------------------------
const CARDS = [
  { key: 'spritzee-en', apiLang: 'en', id: 'sm10-141', isJp: false, note: 'Lá Zac có thật',
    expectName: 'Spritzee', expectSetId: 'sm10', expectSetName: 'Unbroken Bonds', expectNumber: '141' },
  { key: 'latios-en', apiLang: 'en', id: 'sv08-077', isJp: false, note: 'Lá Zac có thật',
    expectName: 'Latios', expectSetId: 'sv08', expectSetName: 'Surging Sparks', expectNumber: '077' },
  { key: 'ditto-ja-s12a', apiLang: 'ja', id: 'S12a-117', isJp: true, note: 'Lá Zac có thật (メタモン / Ditto)',
    expectName: 'メタモン', expectSetId: 'S12a', expectSetName: 'VSTARユニバース', expectNumber: '117' },
  { key: 'ditto-ja-sv4a-144', apiLang: 'ja', id: 'SV4a-144', isJp: true, note: 'Shiny Treasure ex số in 144 — TCGdex JA đã biết THIẾU lá này',
    expectName: 'メタモン', expectSetId: 'SV4a', expectSetName: 'シャイニートレジャーex', expectNumber: '144',
    imageGuess: 'https://assets.tcgdex.net/ja/SV/SV4a/144/high.webp' },
  { key: 'ditto-ja-sv4a-309-replacement', apiLang: 'ja', id: 'SV4a-309', isJp: true,
    note: 'LÁ THAY THẾ cho SV4a-144 (chỉ chạy nếu SV4a-144 không tải được ảnh)',
    expectName: 'メタモン', expectSetId: 'SV4a', expectSetName: '(dict ghi: レイジングサーフ)', expectNumber: '309',
    replacementFor: 'SV4a-144' },
  { key: 'pikachu-en-base', apiLang: 'en', id: 'base1-58', isJp: false, note: 'Tuỳ chọn: Pikachu EN phổ biến (Base Set)',
    expectName: 'Pikachu', expectSetId: 'base1', expectSetName: 'Base Set', expectNumber: '58' },
  { key: 'pikachu-ja-sv8-033', apiLang: 'ja', id: 'SV8-033', isJp: true, note: 'CA LỖI THẬT: ピカチュウex 超電ブレイカー — OCR tên mất hậu tố ex, báo "không có ứng viên"',
    expectName: 'ピカチュウex', expectSetId: 'SV8', expectSetName: '超電ブレイカー', expectNumber: '033' },
  { key: 'pikachu-ja-sv8-136', apiLang: 'ja', id: 'SV8-136', isJp: true, note: 'Bản full-art SAR — crop tên cố định đọc ra rác, số in đúng → fallback theo số in',
    expectName: 'ピカチュウex', expectSetId: 'SV8', expectSetName: '超電ブレイカー', expectNumber: '136',
    imageGuess: 'https://assets.tcgdex.net/ja/SV/SV8/136/high.webp' },
];

// ---------------------------------------------------------------------------
// Sao chép ĐÚNG pipeline tra cứu của app.js bản ocr3: tên lấy dòng đầu tiên
// có chữ; gộp ứng viên đa chiến lược khi ứng viên tốt nhất < 130.
// ---------------------------------------------------------------------------
function ocrNameText(nameRaw) {
  const full = String(nameRaw || '').replace(/\s+/g, ' ').trim();
  for (const line of String(nameRaw || '').split(/\r?\n/)) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (/[0-9A-Za-z\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(t)) return t;
  }
  return full;
}

function searchCandidatesMerged(index, nameText, numberFixed, searchLang) {
  const opts = { lang: searchLang, limit: 6 };
  let candidates = BCTMatch.searchDict(index, { name: nameText, number: numberFixed }, opts);
  const best = candidates.length ? (candidates[0].score || 0) : 0;
  if (best < 130) {
    const extra = [];
    if (numberFixed) extra.push(BCTMatch.searchDict(index, { number: numberFixed }, opts));
    if (nameText) extra.push(BCTMatch.searchDict(index, { name: nameText }, opts));
    const seen = new Set();
    const merged = [];
    for (const list of [candidates, ...extra]) {
      for (const cand of Array.isArray(list) ? list : []) {
        const key = `${cand.setId || ''}|${cand.number || ''}|${cand.name || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(cand);
      }
    }
    merged.sort((a, b) => (b.score || 0) - (a.score || 0));
    candidates = merged.slice(0, 6);
  }
  return candidates;
}

async function fetchCardImage(card) {
  const apiUrl = `https://api.tcgdex.net/v2/${card.apiLang}/cards/${card.id}`;
  const res = { apiUrl, apiStatus: null, apiName: null, apiImage: null, imageUrl: null, imageStatus: null, file: null };
  try {
    const r = await fetch(apiUrl);
    res.apiStatus = r.status;
    if (r.ok) {
      const j = await r.json();
      res.apiName = j.name || null;
      res.apiImage = j.image || null;
      if (j.image) res.imageUrl = j.image + '/high.webp';
    }
  } catch (e) { res.apiError = String(e && e.message || e); }
  if (!res.imageUrl && card.imageGuess) res.imageUrl = card.imageGuess; // thử tải thẳng ảnh (trường hợp API 404)
  if (!res.imageUrl) return res;
  try {
    const ir = await fetch(res.imageUrl);
    res.imageStatus = ir.status;
    if (ir.ok) {
      const buf = Buffer.from(await ir.arrayBuffer());
      res.file = path.join(IMG_DIR, `${card.id}.webp`);
      fs.writeFileSync(res.file, buf);
      res.bytes = buf.length;
      res.buffer = buf;
    }
  } catch (e) { res.imageError = String(e && e.message || e); }
  return res;
}

function isExactCandidate(cand, card) {
  if (!cand) return false;
  return BCTMatch.normName(cand.name) === BCTMatch.normName(card.expectName)
    && String(cand.setId).toLowerCase() === String(card.expectSetId).toLowerCase()
    && BCTMatch.numKey(cand.number) === BCTMatch.numKey(card.expectNumber);
}

function evaluateRun(run, card, numberFixed) {
  const cands = run.candidates || [];
  const top1 = cands[0] || null;
  const rankExact = cands.findIndex((c) => isExactCandidate(c, card)); // 0-based, -1 = không có trong limit 6
  run.top1 = top1;
  // Tiêu chí TÊN đúng (theo task): top-1 khớp tên thật HOẶC text OCR khớp tên thật.
  run.nameTop1Ok = !!top1 && BCTMatch.normName(top1.name) === BCTMatch.normName(card.expectName);
  run.nameOcrTextOk = !!run.nameText && BCTMatch.normName(run.nameText).includes(BCTMatch.normName(card.expectName));
  run.nameOk = run.nameTop1Ok || run.nameOcrTextOk;
  run.numberOk = BCTMatch.numKey(numberFixed) === BCTMatch.numKey(card.expectNumber);
  run.final = rankExact === 0 ? 'top-1 đúng lá'
    : (rankExact >= 1 && rankExact < 5) ? `top-5 có lá đúng (hạng ${rankExact + 1})`
    : (rankExact === 5) ? 'chỉ lọt hạng 6 (ngoài top-5)'
    : 'trượt hẳn';
  run.rankExact = rankExact >= 0 ? rankExact + 1 : null;
  return run;
}

async function main() {
  const started = new Date();
  console.log('OCR live test — deps:', DEPS_DIR, '| dict:', BCT_DICT.cards.length, 'lá');
  const index = BCTMatch.buildIndex(BCT_DICT);
  const results = [];

  // Pass 1: lá chính (kể cả SV4a-144 để ghi nhận 404). Lá thay thế chạy ở pass 2 khi cần.
  const mainCards = CARDS.filter((c) => !c.replacementFor);
  const replacement = CARDS.find((c) => c.replacementFor);
  const queue = [...mainCards];
  let needReplacement = false;

  for (const card of queue) {
    console.log(`\n=== ${card.id} (${card.expectName}) ===`);
    const entry = { card, fetch: null, modes: [], number: null, status: 'ok' };
    const f = await fetchCardImage(card);
    entry.fetch = { apiUrl: f.apiUrl, apiStatus: f.apiStatus, apiName: f.apiName, apiImage: f.apiImage, imageUrl: f.imageUrl, imageStatus: f.imageStatus, file: f.file || null, bytes: f.bytes || null, apiError: f.apiError || null, imageError: f.imageError || null };
    console.log('API:', f.apiStatus, '| ảnh:', f.imageUrl, '->', f.imageStatus, f.file || '');
    if (!f.buffer) {
      entry.status = 'no-image';
      entry.statusDetail = 'Không tải được ảnh từ TCGdex — không test được từ nguồn TCGdex.';
      if (card.id === 'SV4a-144') needReplacement = true;
      results.push(entry);
      continue;
    }

    // --- Vùng số in (dùng chung mọi chế độ, giống app) ---
    const numCrop = await ocrCropBuffer(f.buffer, 0, 0.88, 0.30, 1.0);
    fs.writeFileSync(path.join(CROP_DIR, `${card.id}-num.png`), numCrop);
    const numRaw = await ocrRecognizeText(numCrop, 'eng', { tessedit_char_whitelist: OCR_NUMBER_WHITELIST });
    let numberFixed = String(BCTMatch.fixNumber(numRaw) || '').trim();
    // Giống app: chưa trích được chữ số → thử lại với crop số ĐẢO CỰC.
    let numRawInv = null;
    if (!/\d/.test(BCTMatch.numKey(numberFixed))) {
      const numCropInv = await ocrCropBuffer(f.buffer, 0, 0.88, 0.30, 1.0, true);
      fs.writeFileSync(path.join(CROP_DIR, `${card.id}-num-inv.png`), numCropInv);
      numRawInv = await ocrRecognizeText(numCropInv, 'eng', { tessedit_char_whitelist: OCR_NUMBER_WHITELIST });
      const invFixed = String(BCTMatch.fixNumber(numRawInv) || '').trim();
      // Giống app: chỉ nhận đảo cực khi là mẫu "n/total" hoặc ≥2 chữ số.
      if (invFixed.indexOf('/') >= 0 || BCTMatch.numKey(invFixed).replace(/\D/g, '').length >= 2) numberFixed = invFixed;
    }
    entry.number = { raw: numRaw, rawShown: String(numRaw || '').replace(/\s+/g, ' ').trim(), rawInv: numRawInv, fixed: numberFixed, numKey: BCTMatch.numKey(numberFixed), expectNumKey: BCTMatch.numKey(card.expectNumber) };
    console.log('Số OCR thô:', JSON.stringify(numRaw), numRawInv != null ? '| đảo cực: ' + JSON.stringify(numRawInv) : '', '-> fixNumber:', numberFixed);

    // --- Vùng tên: EN 1 chế độ; JA 2 chế độ so sánh ---
    const nameCrop = await ocrCropBuffer(f.buffer, 0.04, 0.02, 0.75, 0.13);
    fs.writeFileSync(path.join(CROP_DIR, `${card.id}-name.png`), nameCrop);
    const modes = card.isJp
      ? [{ mode: 'jpn+eng (toggle Lá Nhật BẬT)', lang: 'jpn+eng', searchLang: 'jp' },
         { mode: 'eng (toggle Lá Nhật TẮT)', lang: 'eng', searchLang: undefined }]
      : [{ mode: 'eng', lang: 'eng', searchLang: undefined }];
    for (const m of modes) {
      const nameRaw = await ocrRecognizeText(nameCrop, m.lang, null);
      const nameText = ocrNameText(nameRaw);
      const candidates = searchCandidatesMerged(index, nameText, numberFixed, m.searchLang);
      const run = evaluateRun({ mode: m.mode, ocrLang: m.lang, searchLang: m.searchLang ?? null, nameRaw, nameText, candidates }, card, numberFixed);
      entry.modes.push(run);
      console.log(`[${m.mode}] tên OCR:`, JSON.stringify(nameText), '| top1:', candidates[0] ? `${candidates[0].name} / ${candidates[0].setName} / #${candidates[0].number} / score ${candidates[0].score}` : '(không có)', '|', run.final);
    }
    results.push(entry);
  }

  if (needReplacement && replacement) {
    console.log(`\n=== THAY THẾ: ${replacement.id} thay cho ${replacement.replacementFor} ===`);
    queue.push(replacement);
    const card = replacement;
    const entry = { card, fetch: null, modes: [], number: null, status: 'ok', isReplacement: true, replacementReason: 'SV4a-144: TCGdex API 404 + không có ảnh — thay bằng SV4a-309 メタモン (có ảnh trên TCGdex, có trong dict).' };
    const f = await fetchCardImage(card);
    entry.fetch = { apiUrl: f.apiUrl, apiStatus: f.apiStatus, apiName: f.apiName, apiImage: f.apiImage, imageUrl: f.imageUrl, imageStatus: f.imageStatus, file: f.file || null, bytes: f.bytes || null };
    console.log('API:', f.apiStatus, '| ảnh:', f.imageUrl, '->', f.imageStatus);
    if (!f.buffer) { entry.status = 'no-image'; entry.statusDetail = 'Lá thay thế cũng không tải được ảnh.'; results.push(entry); }
    else {
      const numCrop = await ocrCropBuffer(f.buffer, 0, 0.88, 0.30, 1.0);
      fs.writeFileSync(path.join(CROP_DIR, `${card.id}-num.png`), numCrop);
      const numRaw = await ocrRecognizeText(numCrop, 'eng', { tessedit_char_whitelist: OCR_NUMBER_WHITELIST });
      const numberFixed = String(BCTMatch.fixNumber(numRaw) || '').trim();
      entry.number = { raw: numRaw, rawShown: String(numRaw || '').replace(/\s+/g, ' ').trim(), fixed: numberFixed, numKey: BCTMatch.numKey(numberFixed), expectNumKey: BCTMatch.numKey(card.expectNumber) };
      const nameCrop = await ocrCropBuffer(f.buffer, 0.04, 0.02, 0.75, 0.13);
      fs.writeFileSync(path.join(CROP_DIR, `${card.id}-name.png`), nameCrop);
      const modes = [{ mode: 'jpn+eng (toggle Lá Nhật BẬT)', lang: 'jpn+eng', searchLang: 'jp' },
                     { mode: 'eng (toggle Lá Nhật TẮT)', lang: 'eng', searchLang: undefined }];
      for (const m of modes) {
        const nameRaw = await ocrRecognizeText(nameCrop, m.lang, null);
        const nameText = ocrNameText(nameRaw);
        const candidates = searchCandidatesMerged(index, nameText, numberFixed, m.searchLang);
        const run = evaluateRun({ mode: m.mode, ocrLang: m.lang, searchLang: m.searchLang ?? null, nameRaw, nameText, candidates }, card, numberFixed);
        entry.modes.push(run);
        console.log(`[${m.mode}] tên OCR:`, JSON.stringify(nameText), '|', run.final);
      }
      results.push(entry);
    }
  }

  // ---------------- results.md ----------------
  const fmtCand = (c, i) => `${i + 1}. ${c.name} — ${c.setName} (${c.setId}) #${c.number} — score ${c.score}`;
  const dictHasExact = (card) => BCT_DICT.cards.some((r) => String(r[0]) === card.expectName && String(r[1]).toLowerCase() === String(card.expectSetId).toLowerCase() && BCTMatch.numKey(r[2]) === BCTMatch.numKey(card.expectNumber));
  const noImageIds = results.filter((e) => e.status === 'no-image').map((e) => e.card.id);
  let tested = 0, top1Ok = 0, top5Ok = 0, miss = 0, runs = 0, runsTop1 = 0, runsTop5 = 0, runsMiss = 0;
  let nameOkCount = 0, numOkCount = 0, modeRuns = 0;
  const lines = [];
  lines.push('# Kết quả OCR LIVE TEST — Bán Card Thui (E4)');
  lines.push('');
  lines.push(`- Thời gian chạy: ${started.toISOString()} (giờ máy chủ; giờ VN = UTC+7)`);
  lines.push(`- Nguồn ảnh: TCGdex CDN (API https://api.tcgdex.net/v2/{en|ja}/cards/{id} → image + '/high.webp')`);
  lines.push(`- Dictionary: js/cards-dict.js của repo (${BCT_DICT.cards.length} lá, sinh ${BCT_DICT.generated || '?'}) + js/cardmatch.js (buildIndex/searchDict/fixNumber/numKey)`);
  lines.push(`- OCR: tesseract.js v5 (Node) + sharp tiền xử lý; crop tên x 4%–75% y 2%–13%, crop số x 0%–30% y 88%–100%, upscale 2x, grayscale + contrast theo đúng công thức ocrCropCanvas: gray=0.299R+0.587G+0.114B, v=(gray-128)*1.25+128 clamp (sharp: extract → resize 2x → raw → áp công thức từng pixel → PNG; kernel resize lanczos3 khác canvas smoothing là khác biệt duy nhất).`);
  lines.push(`- Số: worker 'eng' + whitelist '${OCR_NUMBER_WHITELIST}' → BCTMatch.fixNumber. Tên EN: 'eng'. Tên JA: chạy cả 'jpn+eng' (lang search 'jp') và 'eng' (lang search undefined).`);
  lines.push('');
  for (const e of results) {
    const c = e.card;
    lines.push(`## ${c.id} — kỳ vọng: ${c.expectName} · set ${c.expectSetId} (${c.expectSetName}) · số ${c.expectNumber}`);
    lines.push(`- Ghi chú: ${c.note}${e.isReplacement ? ' — LÝ DO THAY THẾ: ' + e.replacementReason : ''}`);
    lines.push(`- TCGdex API: ${e.fetch.apiUrl} → HTTP ${e.fetch.apiStatus}; tên API: ${e.fetch.apiName || '—'}; image: ${e.fetch.apiImage || '—'}`);
    lines.push(`- Ảnh dùng test: ${e.fetch.imageUrl || '—'} → HTTP ${e.fetch.imageStatus ?? '—'}${e.fetch.file ? ` (${e.fetch.bytes} bytes, lưu ${e.fetch.file})` : ''}`);
    if (e.fetch.apiStatus !== 200 && e.fetch.imageStatus === 200) lines.push(`- LƯU Ý: API card trả ${e.fetch.apiStatus} nhưng file ảnh trên assets.tcgdex.net vẫn tải được HTTP 200 — vẫn test OCR được trên ảnh thật; xem nhận xét về dictionary ở dưới.`);
    lines.push(`- Dictionary của app có đúng lá kỳ vọng này không: **${dictHasExact(c) ? 'CÓ' : 'KHÔNG — searchDict không bao giờ trả ra lá này, trượt là chắc chắn bất kể OCR'}**`);
    if (e.status === 'no-image') {
      lines.push(`- **KHÔNG TEST ĐƯỢC: ${e.statusDetail}**`);
      lines.push('');
      continue;
    }
    tested++;
    lines.push(`- OCR số thô: \`${e.number.rawShown || '(rỗng)'}\` (nguyên văn có xuống dòng: ${JSON.stringify(e.number.raw)}) → sau fixNumber: \`${e.number.fixed || '(rỗng)'}\` → numKey \`${e.number.numKey}\` vs kỳ vọng \`${e.number.expectNumKey}\` → **SỐ ${e.number.numKey === e.number.expectNumKey ? 'ĐÚNG' : 'SAI'}**`);
    let cardTop1 = false, cardTop5 = false;
    for (const r of e.modes) {
      modeRuns++; runs++;
      if (r.nameOk) nameOkCount++;
      if (r.final === 'top-1 đúng lá') { runsTop1++; cardTop1 = true; cardTop5 = true; }
      else if (r.final.startsWith('top-5')) { runsTop5++; cardTop5 = true; }
      else runsMiss++;
      lines.push(`### Chế độ ${r.mode}`);
      lines.push(`- OCR tên thô: \`${r.nameText || '(rỗng)'}\` (nguyên văn: ${JSON.stringify(r.nameRaw)})`);
      lines.push(`- Tên đúng theo tiêu chí (top-1 khớp tên HOẶC text OCR chứa tên thật): **${r.nameOk ? 'ĐÚNG' : 'SAI'}** (top-1 khớp tên: ${r.nameTop1Ok ? 'có' : 'không'}; text OCR chứa tên thật: ${r.nameOcrTextOk ? 'có' : 'không'}) · Số (chung): **${BCTMatch.numKey(e.number.fixed) === BCTMatch.numKey(c.expectNumber) ? 'ĐÚNG' : 'SAI'}**`);
      lines.push(`- Top-1: ${r.candidates[0] ? fmtCand(r.candidates[0], 0) : '(không có ứng viên)'}`);
      lines.push(`- Ứng viên (tối đa 6 theo limit của app):`);
      if (r.candidates.length) r.candidates.forEach((cc, i) => lines.push(`  - ${fmtCand(cc, i)}${isExactCandidate(cc, c) ? '  ← LÁ ĐÚNG' : ''}`));
      else lines.push('  - (rỗng)');
      lines.push(`- **Kết quả cuối: ${r.final}**`);
    }
    if (cardTop1) top1Ok++; else if (cardTop5) top5Ok++; else miss++;
    lines.push('');
  }
  const summary = { testedCards: tested, top1Cards: top1Ok, top5OnlyCards: top5Ok, missCards: miss, modeRuns, runsTop1, runsTop5OrBetter: runsTop1 + runsTop5, runsMiss, nameOkRuns: nameOkCount, numberOkCards: results.filter((e) => e.number && e.number.numKey === e.number.expectNumKey).length };
  lines.push('## Tổng kết');
  lines.push('');
  lines.push(`- Lá test được (có ảnh): ${summary.testedCards}. Lá không test được: ${noImageIds.length ? noImageIds.join(', ') : 'không có'}. (SV4a-144: API 404 + dict không có, NHƯNG ảnh trên assets CDN vẫn HTTP 200 nên test được; lá thay thế SV4a-309 vì thế KHÔNG cần chạy.)`);
  lines.push(`- Theo LÁ (lá JA tính đạt nếu 1 trong 2 chế độ đạt): top-1 đúng ${summary.top1Cards}/${summary.testedCards} · chỉ top-5 ${summary.top5OnlyCards}/${summary.testedCards} · trượt hẳn ${summary.missCards}/${summary.testedCards}.`);
  lines.push(`- Theo LẦN CHẠY (run — lá JA có 2 run): ${summary.modeRuns} run · top-1 ${summary.runsTop1} · top-5 (gồm top-1) ${summary.runsTop5OrBetter} · trượt/ngoài top-5 ${summary.runsMiss}.`);
  lines.push(`- Tên đúng theo tiêu chí (top-1 khớp tên hoặc text OCR chứa tên thật): ${summary.nameOkRuns}/${summary.modeRuns} run. Số sau fixNumber đúng (numKey): ${summary.numberOkCards}/${summary.testedCards} lá.`);
  lines.push('');
  lines.push('Nhận xét chi tiết (crop nào yếu, vì sao): xem báo cáo của agent E4 — số liệu thô ở results.json cùng thư mục.');
  fs.writeFileSync(path.join(OUT_DIR, 'results.md'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify({ startedAt: started.toISOString(), summary, results }, null, 2));
  console.log('\nTỔNG KẾT:', JSON.stringify(summary));
  console.log('Đã ghi:', path.join(OUT_DIR, 'results.md'));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
