// price-proxy — Edge Function lấy giá hộ cho Bán Card Thui.
//
// Vì sao cần: TCGdex trả mục tcgplayer = NULL cho đường mạng phía trình
// duyệt của Zac (đã xác nhận bằng dòng chẩn đoán trong app), còn
// pokemontcg.io phía đó trả HTTP 500. Gọi từ máy chủ thì cả hai nguồn đều
// đầy đủ → function này lấy giá phía server rồi trả về dạng đã chuẩn hoá:
//   GET /functions/v1/price-proxy?set=swsh7&number=049
//   → { sources: [{source, price, currency, kind, updated_at}...], diag }
//
// Cách bật (1 lần): Supabase Dashboard → Edge Functions → Create function
// → tên "price-proxy" → dán file này → Deploy. Hoặc triển khai bằng CLI.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

type Src = {
  source: string;
  price: number;
  currency: string;
  kind: string;
  updated_at: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function firstNonNull(...vals: unknown[]): number | null {
  for (const v of vals) if (v != null) return v as number;
  return null;
}

// Cùng quy tắc đọc giá như parser trong app (js/store.js).
function fromTcgdex(pricing: any): Src[] {
  if (!pricing) return [];
  const out: Src[] = [];
  const cm = pricing.cardmarket;
  if (cm) {
    const p = firstNonNull(cm.trend, cm.avg, cm.low);
    if (p != null) {
      out.push({
        source: "cardmarket", price: Number(p), currency: "EUR",
        kind: cm.trend != null ? "trend" : "avg",
        updated_at: cm.updated || null,
      });
    }
  }
  const tp = pricing.tcgplayer ?? pricing.tcgPlayer;
  if (tp) {
    const p = firstNonNull(
      tp.holofoil?.marketPrice,
      tp.normal?.marketPrice,
      tp["reverse-holofoil"]?.marketPrice,
    );
    if (p != null) {
      out.push({
        source: "tcgplayer", price: Number(p), currency: "USD",
        kind: "market", updated_at: tp.updated || null,
      });
    }
  }
  return out;
}

function fromPokemonTcgIo(d: any): Src[] {
  if (!d) return [];
  const out: Src[] = [];
  const iso = (s: unknown) => (s ? String(s).replace(/\//g, "-") : null);
  const cm = d.cardmarket?.prices;
  if (cm) {
    const p = cm.trendPrice != null ? cm.trendPrice : cm.averageSellPrice;
    if (p != null) {
      out.push({
        source: "cardmarket", price: Number(p), currency: "EUR",
        kind: cm.trendPrice != null ? "trend" : "avg",
        updated_at: iso(d.cardmarket.updatedAt),
      });
    }
  }
  const tp = d.tcgplayer?.prices;
  if (tp) {
    const p = firstNonNull(tp.holofoil?.market, tp.normal?.market, tp.reverseHolofoil?.market);
    if (p != null) {
      out.push({
        source: "tcgplayer", price: Number(p), currency: "USD",
        kind: "market", updated_at: iso(d.tcgplayer.updatedAt),
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const u = new URL(req.url);
    const set = (u.searchParams.get("set") || "").trim();
    const raw = (u.searchParams.get("number") || "").trim();
    if (!set || !raw) return json({ error: "Thiếu tham số set/number" }, 400);

    // localId của TCGdex/pokemontcg.io đều không đệm 0 cho số thuần.
    const candidates: string[] = [];
    if (/^\d+$/.test(raw)) {
      const unpadded = String(parseInt(raw, 10));
      if (unpadded !== raw) candidates.push(unpadded);
    }
    candidates.push(raw);
    const idPath = (num: string) =>
      `${encodeURIComponent(set)}-${encodeURIComponent(num)}`;

    // LƯU Ý: khoảnh khắc TCGdex trả tcgplayer = NULL được xử lý bằng cách
    // APP tự gọi lại function này tối đa 2 vòng (xem fetchPrices trong
    // js/store.js) — bản function đang deploy giữ nguyên vòng đơn.
    let sources: Src[] = [];
    let diag = "";
    for (const num of candidates) {
      const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${idPath(num)}`);
      if (r.status === 404) { diag = "tcgdex 404"; continue; }
      if (!r.ok) { diag = `tcgdex HTTP ${r.status}`; break; }
      const card = await r.json();
      sources = fromTcgdex(card?.pricing);
      diag = `tcgdex ${sources.length} nguồn`;
      break;
    }
    if (sources.length < 2) {
      for (const num of candidates) {
        try {
          const r = await fetch(`https://api.pokemontcg.io/v2/cards/${idPath(num)}`);
          if (!r.ok) { diag += `, io HTTP ${r.status}`; continue; }
          const body = await r.json();
          const extra = fromPokemonTcgIo(body?.data);
          const have = new Set(sources.map((s) => s.source));
          for (const e of extra) if (!have.has(e.source)) sources.push(e);
          diag += `, io lấp → ${sources.length} nguồn`;
          break;
        } catch (e) {
          diag += `, io lỗi ${e}`;
        }
      }
    }
    return json({ sources, diag });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
