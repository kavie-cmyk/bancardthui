/* Bán Card Thui — config.js
 * Thông tin kết nối Supabase. Anon key là public theo thiết kế của Supabase
 * (giới hạn quyền bằng RLS/policies phía server); không dùng service_role ở client.
 */
(function (root) {
  'use strict';
  root.SUPABASE_URL = 'https://ntfvcajbmmduloxbnygd.supabase.co';
  root.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50ZnZjYWpibW1kdWxveGJueWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NjA3NDAsImV4cCI6MjEwNzUzNjc0MH0.IiAZohnZZpBYWIWAUpmXpXk64GNDV0n_odYXQsfqYS0';
  // Tỷ giá quy đổi ngoại tệ→VND để tính giá tham khảo (ƯỚC TÍNH — sửa trực tiếp tại đây)
  root.EUR_VND = 28000;
  root.USD_VND = 26000;
  root.JPY_VND = 170;
  // Hệ số giá theo condition — giá thị trường full-cond nhân với hệ số này (ƯỚC TÍNH — sửa trực tiếp tại đây)
  root.CONDITION_FACTOR = { 'New Mint': 1.0, 'A': 0.9, 'B': 0.75, 'C': 0.55, 'D': 0.35 };

  // ---- Nguồn giá tham khảo (PLUGGABLE) ----
  // Thêm nguồn mới chỉ cần 2 bước, không sửa kiến trúc:
  //   1) thêm 1 def vào PRICE_SOURCE_DEFS bên dưới,
  //   2) đăng ký fetcher trong js/store.js → PRICE_FETCHERS (mỗi fetcher: async (setId, number, card) → [sourceEntry...]).
  // eBay: tài khoản dev kavie2004 đã đăng ký, đang chờ duyệt thủ công (~1 ngày làm việc) để cấp App ID.
  // Khi có App ID: dán vào EBAY_APP_ID bên dưới + viết body fetchEbayPricing trong store.js (đã để sẵn TODO).
  root.EBAY_APP_ID = '';
  // CardSight AI — nhận diện thẻ từ ảnh (view "Quét thẻ"). Chỉ để URL endpoint ở đây.
  // API key TUYỆT ĐỐI không ghi vào file này (repo public): user dán key trong
  // view Quét thẻ, app lưu ở localStorage của trình duyệt (key bct_cardsight_key).
  root.CARDSIGHT_ID_URL = 'https://api.cardsight.ai/v1/identify/card';
  root.PRICE_SOURCE_DEFS = [
    { key: 'cardmarket', label: 'Cardmarket', auto: 'tcgdex' }, // auto qua TCGdex pricing
    { key: 'tcgplayer',  label: 'TCGplayer',  auto: 'tcgdex' }, // auto qua TCGdex pricing
    // eBay: Zac chốt bỏ 2026-10-21 (đăng ký eBay Developer bị reject) — không còn
    // nguồn giá eBay. Kênh BÁN "ebay" trong Đơn hàng là chuyện khác, vẫn giữ.
    { key: 'other',      label: 'Khác',       auto: null }      // chỉ nhập tay
  ];
})(typeof window !== 'undefined' ? window : globalThis);
