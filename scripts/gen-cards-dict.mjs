#!/usr/bin/env node
/*
 * Bán Card Thui — gen-cards-dict.mjs
 *
 * Sinh js/cards-dict.js (dictionary thẻ Pokémon TCG cho OCR scan + tra cứu offline)
 * từ API TCGdex:
 *   - https://api.tcgdex.net/v2/en/cards  + https://api.tcgdex.net/v2/ja/cards
 *   - https://api.tcgdex.net/v2/en/sets   + https://api.tcgdex.net/v2/ja/sets
 *
 * Chạy:  node scripts/gen-cards-dict.mjs        (Node 18+, không cần dependency ngoài)
 *
 * Format đầu ra (HỢP ĐỒNG — các module khác code theo đúng format này):
 *   window.BCT_DICT = {
 *     v: 1,
 *     generated: "<ISO date>",
 *     sets:  { "<setId>": ["<tên set EN>", "<tên set JA hoặc ''>"], ... },
 *     cards: [ ["<tên gốc>", "<setId>", "<localId>", 0|1], ... ]   // lang: 0 = en, 1 = jp
 *   }
 * Không lưu URL ảnh, không lưu tên chuẩn hoá (runtime tự tính).
 */
import { writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://api.tcgdex.net/v2';
const ITEMS_PER_PAGE = 1000; // TCGdex tôn trọng pagination:page / pagination:itemsPerPage
const MAX_PAGES = 500; // chốt an toàn, thực tế EN ~24 trang, JA ~13 trang
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'cards-dict.js');

/** Fetch JSON với retry đơn giản (3 lần, backoff tăng dần). */
async function fetchJson(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw lastErr;
}

/**
 * Lấy TOÀN BỘ một list của TCGdex theo từng trang cho đến khi hết.
 * Trang cuối có ít hơn ITEMS_PER_PAGE phần tử (hoặc rỗng) thì dừng.
 * (Không kèm tham số phân trang, TCGdex hiện trả cả list trong 1 lần,
 *  nhưng đi theo trang để không bị cắt âm thầm nếu API đổi mặc định.)
 */
async function fetchAllPages(path) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${BASE}/${path}?pagination:page=${page}&pagination:itemsPerPage=${ITEMS_PER_PAGE}`;
    const chunk = await fetchJson(url);
    if (!Array.isArray(chunk)) throw new Error(`Phản hồi không phải mảng: ${url}`);
    all.push(...chunk);
    if (chunk.length < ITEMS_PER_PAGE) break;
    if (page === MAX_PAGES) throw new Error(`Vượt quá ${MAX_PAGES} trang: ${path}`);
  }
  return all;
}

/**
 * Suy setId từ id của lá. id có dạng "<setId>-<localId>".
 * Cắt đúng hậu tố "-" + localId ở cuối (localId có thể chứa chữ cái / số thập phân,
 * vd "GG22", "10.5" trong setId "swsh10.5", "XY40"...). Nếu hậu tố không khớp
 * (dữ liệu lệch), fallback: cắt tại dấu "-" cuối cùng.
 */
function deriveSetId(id, localId) {
  const suffix = `-${localId}`;
  if (id.endsWith(suffix)) return id.slice(0, id.length - suffix.length);
  const idx = id.lastIndexOf('-');
  return idx > 0 ? id.slice(0, idx) : id;
}

async function main() {
  const generated = new Date().toISOString();

  // --- 1. Tên set (EN + JA) -------------------------------------------------
  const [setsEn, setsJa] = await Promise.all([
    fetchAllPages('en/sets'),
    fetchAllPages('ja/sets'),
  ]);
  const sets = {}; // setId -> [tên EN, tên JA]
  for (const s of setsEn) {
    if (s && s.id) (sets[s.id] ||= ['', ''])[0] = typeof s.name === 'string' ? s.name : '';
  }
  for (const s of setsJa) {
    if (s && s.id) (sets[s.id] ||= ['', ''])[1] = typeof s.name === 'string' ? s.name : '';
  }

  // --- 2. Danh sách lá (EN + JA) -------------------------------------------
  const cards = [];
  const seen = new Set(); // khử trùng lặp theo (lang, setId, localId, name)
  const counts = { en: 0, ja: 0 };
  let skipped = 0;

  const langs = [
    { lang: 'en', flag: 0 },
    { lang: 'ja', flag: 1 },
  ];
  for (const { lang, flag } of langs) {
    const list = await fetchAllPages(`${lang}/cards`);
    for (const raw of list) {
      const name = raw && typeof raw.name === 'string' ? raw.name : '';
      const localId = raw && raw.localId != null ? String(raw.localId) : '';
      const id = raw && typeof raw.id === 'string' ? raw.id : '';
      if (!name || !localId || !id) {
        skipped++; // loại lá thiếu name hoặc localId (hoặc thiếu id để suy setId)
        continue;
      }
      const setId = deriveSetId(id, localId);
      const key = `${flag}|${setId}|${localId}|${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push([name, setId, localId, flag]);
      counts[lang]++;
      // Set chỉ xuất hiện ở phía lá mà không có trong list sets: vẫn tạo ô trống
      // để mọi setId trong cards đều tra được trong sets.
      if (!sets[setId]) sets[setId] = ['', ''];
    }
  }

  // --- 3. Ghi file ----------------------------------------------------------
  const dict = { v: 1, generated, sets, cards };
  const header =
    `/* Bán Card Thui — cards-dict.js (TỰ SINH, đừng sửa tay — chạy lại: node scripts/gen-cards-dict.mjs)\n` +
    ` * Nguồn: TCGdex API (https://api.tcgdex.net/v2/en/cards, /ja/cards, /en/sets, /ja/sets)\n` +
    ` * Ngày sinh: ${generated}\n` +
    ` * Số lá: ${counts.en + counts.ja} (EN: ${counts.en}, JA: ${counts.ja}) — ${Object.keys(sets).length} set\n` +
    ` * Format: BCT_DICT = { v, generated, sets: { setId: [tên EN, tên JA] }, cards: [ [tên gốc, setId, localId, lang] ] } — lang: 0 = en, 1 = jp\n` +
    ` */\n`;
  const body =
    `(function () {\n` +
    `  'use strict';\n` +
    `  var BCT_DICT = ${JSON.stringify(dict)};\n` +
    `  if (typeof window !== 'undefined') window.BCT_DICT = BCT_DICT;\n` +
    `  if (typeof module !== 'undefined') module.exports = BCT_DICT;\n` +
    `})();\n`;
  writeFileSync(OUT_PATH, header + body, 'utf8');

  const { size } = statSync(OUT_PATH);
  console.log(`EN: ${counts.en} lá`);
  console.log(`JA: ${counts.ja} lá`);
  console.log(`Tổng: ${counts.en + counts.ja} lá (${skipped} lá bị loại do thiếu name/localId/id)`);
  console.log(`Số set phân biệt: ${Object.keys(sets).length}`);
  console.log(`File: ${OUT_PATH}`);
  console.log(`Dung lượng: ${size} byte`);
}

main().catch((err) => {
  console.error('Lỗi sinh cards-dict:', err);
  process.exit(1);
});
