// price-proxy — Edge Function dự phòng cho tính năng kéo giá.
//
// Vì sao có file này: TCGdex trả thiếu mục tcgplayer (null) cho một số
// đường mạng (đã gặp phía trình duyệt của Zac), trong khi gọi từ máy chủ
// thì luôn đầy đủ. Khi bật function này, app có thể lấy giá qua Supabase
// của chính shop: trình duyệt → Supabase → TCGdex, bỏ qua đường mạng lỗi.
//
// Cách bật (làm 1 lần, ~2 phút):
//   Supabase Dashboard → Edge Functions → Create a new function
//   → đặt tên "price-proxy" → dán toàn bộ file này → Deploy.
// Sau đó báo Miso để trỏ app sang đường này.
//
// Gọi: GET /functions/v1/price-proxy?set=swsh7&number=049
// Trả: JSON lá bài của TCGdex (nguyên trạng, gồm pricing đầy đủ).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const u = new URL(req.url);
    const set = (u.searchParams.get("set") || "").trim();
    const raw = (u.searchParams.get("number") || "").trim();
    if (!set || !raw) return json({ error: "Thiếu tham số set/number" }, 400);

    // TCGdex dùng localId không đệm 0 cho số thuần ("49", không phải "049").
    const candidates: string[] = [];
    if (/^\d+$/.test(raw)) {
      const unpadded = String(parseInt(raw, 10));
      if (unpadded !== raw) candidates.push(unpadded);
    }
    candidates.push(raw);

    let lastStatus = 0;
    for (const num of candidates) {
      const r = await fetch(
        `https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(set)}-${encodeURIComponent(num)}`,
        { headers: { "User-Agent": "bancardthui-price-proxy" } },
      );
      lastStatus = r.status;
      if (r.status === 404) continue;
      if (!r.ok) return json({ error: `TCGdex HTTP ${r.status}` }, 502);
      const data = await r.json();
      return json(data);
    }
    return json({ error: "Không tìm thấy lá trên TCGdex", status: lastStatus }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
