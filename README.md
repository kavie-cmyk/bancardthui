# Bán Card Thui — Quản lý kho Pokémon TCG

Web app quản lý kho card Pokémon cá nhân: nhập kho theo lô, bán hàng trừ kho FIFO,
dashboard lãi/lỗ thực tế, bộ sưu tập theo set và quản lý tin rao bán.
Chạy ngay không cần build step. Dữ liệu lưu trên **Supabase** (Postgres + Storage),
đăng nhập bằng magic link qua email.

> Bản cũ lưu dữ liệu ở localStorage (key `bct_state_v1`) — đã thay bằng Supabase.
> Mô tả localStorage trong các bản README trước không còn đúng nữa.

## Cách chạy

Bản đang dùng: **https://kavie-cmyk.github.io/bancardthui/** (GitHub Pages từ repo này).

Chạy local để phát triển:

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

Nên chạy qua http server thay vì mở thẳng file `index.html`: link đăng nhập (magic link)
cần một URL khớp với Redirect URL đã cấu hình trong Supabase Auth.

Kho trống giữ nguyên trạng thái trống; app không tự nạp dữ liệu mẫu.

Cần internet cho Supabase, Google Fonts và ảnh card từ TCGdex CDN.

## Đăng nhập & backend (Supabase)

- Project Supabase và anon key nằm trong `js/config.js`. Anon key là public theo
  thiết kế của Supabase — quyền truy cập phải giới hạn bằng **RLS/policies phía server**,
  không bao giờ dùng `service_role` ở client.
- `js/auth.js`: đăng nhập magic link (`/auth/v1/otp`, `create_user: false` — chỉ email
  đã được tạo user sẵn trong Supabase Auth mới đăng nhập được). Session lưu ở
  localStorage key `bct_session`, tự refresh khi hết hạn / khi gặp HTTP 401.
- `js/db.js`: wrapper PostgREST + Storage bằng `fetch` thuần: retry khi lỗi mạng
  (timeout 20s/lần, tối đa 3 lần), gặp 401 thì refresh session 1 lần rồi thử lại.
- Nếu gặp lỗi kiểu "column ... does not exist" khi chạy với DB chưa migrate đủ cột:
  `js/store.js` có cơ chế insert/update *tolerant* — tự bỏ các cột "có thể chưa có"
  (`CARD_MAYBE_COLS`, `LOT_MAYBE_COLS`) và thử lại. Cách xử lý đúng lâu dài vẫn là
  chạy đủ `supabase/schema.sql` trong SQL Editor.

## Data model (Supabase — xem `supabase/schema.sql`)

| Bảng | Trường chính |
| --- | --- |
| `cards` | id, name, `set`, set_id (TCGdex), number, rarity, condition (`New Mint`/`A`/`B`/`C`/`D`), graded_org/graded_score, cert_number, cert_pop, language (`en`/`jp`/`other`), storage_location, misprint, market_price/market_currency/market_source/market_updated_at, price_sources (jsonb) |
| `inventory_lots` | id, card_id, qty, qty_remaining, cost_per_unit (VND), import_date, source, condition, variant (Normal/Reverse Holo/Holo/1st Edition), holo_pattern |
| `orders` | id, date, channel (`ebay`/`shopee`/`facebook`/`tructiep`), items (jsonb: card_id, lot_id, qty, sell_price, cost_per_unit), fees, shipping_fee, buyer, note |
| `card_images` | id, card_id, url, sort_order — ảnh user tự chụp, file nằm ở bucket Storage `card-images` (public) |
| `custom_sets` | id (`custom-xxx`), name, total, official, year, note |
| `set_totals` | set_key (PK), total — tổng số lá nhập tay cho set không tra được trong danh sách chuẩn |
| `listings` | id, card_id, lot_id, price (VND), qty, status (`draft`/`active`/`sold`/`hidden`), channel |

Ảnh card hiển thị theo thứ tự ưu tiên: ảnh user tự chụp (Storage) → ảnh chính thức từ
TCGdex CDN (dựng từ set_id + số thứ tự + ngôn ngữ) → ảnh placeholder.

## Các view

- **Tổng quan** — KPI kho/doanh thu/lãi, biểu đồ tuần, bán chạy, tồn lâu nhất, hoạt động gần đây.
- **Kho card** — lọc theo set/độ hiếm/ngôn ngữ/mẫu holo/vị trí lưu trữ, chỉ lá lỗi in, chỉ lá graded; chi tiết từng card (các lô, lịch sử giá bán, giá thị trường, tin rao của lá đó).
- **Bộ sưu tập** — theo set, checklist (xem mục riêng phía dưới).
- **Nhập kho** — mỗi lần nhập là 1 lô. Tạo card mới ngay trong form (có cảnh báo nếu trùng tên + số + set với card đã có), hoặc chọn card có sẵn để nhập thêm lô. Ảnh chụp tự nén còn ~800px JPEG trước khi up lên Storage.
- **Bán hàng** — tạo đơn, xem trước FIFO trước khi chốt.
- **Rao bán** — quản lý `listings`: tạo tin rao (chặn số lượng vượt tồn kho), đổi trạng thái Nháp / Đang rao / Đã bán / Đã ẩn, xóa tin. Đây là quản lý nội bộ để chuẩn bị bán — chưa phải trang bán hàng công khai.
- **Đơn hàng** — danh sách + chi tiết từng đơn (trừ đúng lô nào).

## Bộ sưu tập theo set (view "Bộ sưu tập")

- Danh sách 220 set lấy từ [TCGdex](https://api.tcgdex.net) (`js/sets-db.js`, snapshot 2026-10-14), mỗi set có tổng số lá, số lá chính thức và năm phát hành.
- Mỗi set hiện progress bar **số lá unique còn hàng ÷ tổng số lá**, số lá thiếu, tổng thẻ tồn, giá trị kho ước tính.
- Bấm vào set → **checklist** đánh số 1..tổng: lá đã có sáng + badge số lượng, lá thiếu mờ đi; lá có số vượt số lá chính thức gắn tag **SECRET**.
- Set không tra được tổng số lá → nhập tay ngay trên thẻ set (lưu vào `set_totals`).
- Filter theo năm phát hành, ngôn ngữ + chế độ **nhóm theo năm** (mới → cũ).
- Nút **?** ở đầu trang Kho giải thích ký hiệu độ hiếm (● ◆ ★ …) bằng tiếng Việt.

### Phiên bản in & checklist 2 chế độ

- Mỗi lô nhập có **phiên bản**: Normal / Reverse Holo / Holo / 1st Edition (chọn lúc nhập kho; dữ liệu cũ mặc định Normal). Condition của lô lấy theo condition của card.
- Tiến độ set tính theo chuẩn **complete set**: 1 số thứ tự chỉ tính 1 lần dù có nhiều bản trùng (badge ×N hiện tổng số bản).
- Checklist có toggle **Set chuẩn / Master**: Master hiện breakdown phiên bản từng ô (vd "Reverse Holo ×2 · Holo ×1") mà không đổi cách tính tiến độ.
- Bấm vào ô đã có → panel: xem card đang chiếm ô + variant, nút **Sửa lá**, form **Đổi số/set** (đổi số thứ tự, set, độ hiếm — lô & đơn giữ nguyên), **Gỡ khỏi set**.
- Ô trống có nút **+ thêm** → mở Nhập kho đã điền sẵn set + số thứ tự.

### Set tự tạo (Quản lý set)

- Nút **Quản lý set** ở đầu trang Bộ sưu tập → route `#/sets/manage`.
- 220 set TCGdex chỉ đọc; chỉ set tự tạo mới thêm/sửa/xóa được (lưu ở bảng `custom_sets`, id dạng `custom-xxx`).
- Thêm/sửa: Tên set (bắt buộc), Năm phát hành (tùy chọn), Tổng số lá (bắt buộc, >0), Số lá chính (bắt buộc, ≤ tổng), Ghi chú. Validate inline.
- Xóa set đang có card → panel xác nhận, bắt buộc tick "Chuyển N lá sang Chưa phân loại" rồi mới xóa; các card bị gỡ `set_id`.
- Set tự tạo xuất hiện đầu danh sách gợi ý khi nhập set (gắn tag "Tự tạo"), render trong Bộ sưu tập/checklist/lọc năm y như set chuẩn.

## Giá tham khảo thị trường

- Nguồn giá cấu hình ở `js/config.js` → `PRICE_SOURCE_DEFS` (cơ chế pluggable: thêm def + đăng ký fetcher trong `PRICE_FETCHERS` ở `js/store.js`).
- Đang chạy: **Cardmarket** và **TCGplayer**. Trình duyệt lấy TCGdex theo đúng ngôn ngữ + set_id + số lá. Nếu còn thiếu, gọi `price-proxy` ngay; không thử đổi tiếng Anh sang Pháp/Đức để lấy giá.
- Máy chủ có thêm nguồn giá TCGplayer qua [TCGCSV](https://tcgcsv.com/docs), ghép **đúng bộ bài → số lá → productId → marketPrice**. Trường hợp trùng mã sản phẩm không phân biệt được thì bỏ qua, không chọn đại. Cả trình duyệt và máy chủ dùng parser chung `js/pricing.js`, có hỗ trợ các tên biến thể và giá unlimited/1st-edition.
- TCGCSV chỉ được gọi từ backend và lưu vào `price_feed_cache` tối đa một lần mỗi 24 giờ cho mỗi tài nguyên. Đọc `last-updated.txt` trước khi tải lại; nếu build không đổi thì giữ dữ liệu. Ngày trên giá là ngày dữ liệu nguồn, không phải thời điểm người dùng bấm nút. Cache cũ tối đa 7 ngày chỉ dùng khi nguồn lỗi và giữ nguyên ngày gốc.
- Nếu một nguồn tạm mất, app giữ giá cũ của nguồn đó và giá nhập tay ở nguồn khác. Không phụ thuộc file giá cố định cho từng lá trong `prices/`. Không dùng giá tiếng Anh để định giá lá tiếng Nhật: kiểm tra lại đúng mã set của ngôn ngữ đó.
- **eBay** không có trong nguồn giá tự động đang bật (`js/config.js`). Nguồn “Khác” chỉ nhập tay.
- Giá quy đổi về VND bằng tỷ giá ước tính trong `js/config.js` (`EUR_VND`, `USD_VND`, `JPY_VND`) rồi nhân hệ số condition (`CONDITION_FACTOR`: New Mint 1.0 / A 0.9 / B 0.75 / C 0.55 / D 0.35). Đây là giá **tham khảo ước tính**, không phải giá chốt.
- Nhập giá tay được (nguồn "Khác") và lưu cùng các nguồn tự động trong `cards.price_sources`.

### Triển khai và kiểm tra phần giá

1. Chạy `supabase/price-feed-cache.sql` một lần. Bảng bật RLS, thu hồi quyền `anon`/`authenticated`; chỉ backend `service_role` được đọc/ghi. Không lưu dữ liệu kho vào cache.
2. Deploy Edge Function `price-proxy`, giữ **Verify JWT bật**, bao gồm `supabase/functions/price-proxy/index.ts` và dependency `js/pricing.js`. `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` lấy từ biến môi trường mặc định của Edge Functions; không đưa service key vào frontend.
3. Publish các file frontend cùng nhau, gồm `js/pricing.js` trước `js/store.js` như `index.html`.
4. Chạy `node --test tests/*.test.mjs` (Node 24+). CI tự chạy các kiểm thử này khi phần giá thay đổi.
5. Kiểm tra đường dự phòng bằng `GET /functions/v1/price-proxy?set=sv08&number=226&missing=tcgplayer` với headers xác thực hiện có. Kết quả thành công chứa `sources` với `via: "tcgcsv"`, `product_id` và `updated_at`; lần gọi kế tiếp đọc cache, không tải lại bộ giá. Nếu feed không có lá đó, app vẫn hiển thị nguồn lấy được và giữ giá đã lưu.

## FIFO — logic cốt lõi

- Mỗi lần nhập = **1 lô riêng** (giá cost + ngày nhập của lô đó).
- Bán hàng trừ lô **cũ nhất trước** (`consumeFIFO` trong `js/store.js`), ném lỗi nếu không đủ hàng — không bao giờ âm kho.
- Lãi/đơn = Σ(qty × giá bán) − Σ(qty × cost lô thực tế) − phí sàn − phí ship.
- Form Bán hàng có **xem trước FIFO**: hiện sẽ trừ lô nào, cost bao nhiêu, trước khi xác nhận.

## Sao lưu

Nút **"Xuất JSON"** trên header tải về toàn bộ dữ liệu (cards, inventory_lots, orders,
card_images, custom_sets, set_totals, listings) — nên xuất định kỳ, đặc biệt trước khi
xóa dữ liệu mẫu hoặc migrate DB.

## Cấu trúc file

```
index.html            Khung app + nav
css/style.css         Theme "collector's vault" (dark ink + amber, grain, foil)
js/config.js          Cấu hình Supabase, tỷ giá, hệ số condition, nguồn giá
js/auth.js            Magic-link login qua Supabase Auth, quản lý session
js/db.js              Wrapper Supabase PostgREST + Storage (fetch thuần)
js/store.js           Lớp dữ liệu + logic nghiệp vụ: FIFO, tính toán, giá, listings (dùng được cả trong Node để test)
js/seed.js            Dữ liệu mẫu (đi qua đúng logic ghi DB thật nên số liệu nhất quán)
js/sets-db.js         Snapshot 220 set TCGdex
js/app.js             Router + views: Tổng quan / Kho / Bộ sưu tập / Nhập kho / Bán hàng / Rao bán / Đơn hàng
supabase/schema.sql   Toàn bộ schema (bảng, index, ghi chú Storage bucket + RLS)
```

## Còn phải làm (Phase 2 — web bán hàng)

1. **Storefront công khai**: trang bán hàng đọc `listings` ở trạng thái `active` +
   `card_images`; đơn mới ghi vào `orders`. App quản lý này đã có sẵn quản lý listings
   nội bộ, storefront là phần còn thiếu.
2. **Bật RLS thật**: phần RLS trong `supabase/schema.sql` hiện vẫn là ghi chú/comment.
   Trước khi mở storefront công khai phải bật RLS + viết policy (chủ shop ghi mọi thứ,
   khách chỉ đọc listings `active`).
3. **eBay pricing** khi có App ID (xem mục Giá tham khảo).
4. Kiểm tra Redirect URL của Supabase Auth khớp mọi domain/localhost đang dùng,
   nếu không magic link sẽ lỗi khi đăng nhập từ địa chỉ mới.

## Giao diện Hoenn (nút Poké Ball)

Bấm Poké Ball để bật/tắt giao diện Ruby/Sapphire; lựa chọn lưu trong trình duyệt.
Giao diện Hoenn có nền pixel riêng, sprite từ bản GBA và màn hình kho dạng bảng
với khung xem nhanh, phân trang, bộ lọc và kéo giá. Chuyển theme không đổi dữ liệu
kho, nguồn giá hay cách tính vốn. Ảnh nền và nguồn sprite ở `assets/hoenn/README.md`.

`tests/hoenn-ui.html` là fixture giao diện với dữ liệu giả trong bộ nhớ, không
kết nối Supabase. Dùng để kiểm tra desktop/mobile, chuyển theme, bộ lọc, phân
trang, chọn thẻ và cập nhật giá mà không ghi vào kho thật.

## Quét thẻ và mẫu holo

- `Checklist` / `Base Checklist` là nhãn catalog của CardSight. Khi gặp nhãn này,
  parser dùng `releaseName`; nếu không có tên thật, form yêu cầu chọn set trước khi lưu.
  Cả tạo mới và sửa card đều chặn tên set `Checklist` ở lớp dữ liệu.
- `js/sets-db.js` chứa thêm 184 set Nhật, lấy từ
  <https://api.tcgdex.net/v2/ja/sets> ngày 2026-10-21. Có thể chọn bằng tên Nhật hoặc
  mã như `SV2a`. Chỉ khớp chính xác trong đúng ngôn ngữ; tên phiên âm chưa khớp được
  giữ nguyên và không tự gán mã set Anh. Không dùng UUID CardSight làm mã TCGdex.
- Set Nhật dùng khóa nhóm `ja:<id>` để tách checklist Anh/Nhật, kể cả mã trùng nhau
  như `neo1`. So khớp card nhập qua quét cũng kiểm tra ngôn ngữ.
- Phiên bản in (Normal / Holo / Reverse Holo) và mẫu màng holo là hai trường riêng.
  Mẫu holo có gợi ý mở rộng, đồng thời cho nhập tên tùy ý ở nhập kho, sửa lô, quét thẻ;
  các tên đã dùng sẽ xuất hiện lại trong gợi ý. Không đổi giá trị holo cũ.
- Theo [schema CardSight](https://api.cardsight.ai/documentation), vị trí đầu danh sách
  `parallelSuggestions` không đồng nghĩa đã xác nhận. Chỉ tự chọn finish khi có duy
  nhất một gợi ý High nhận diện được; các trường hợp còn lại yêu cầu chọn ở form.
- Kiểm tra hồi quy: `node --test tests/*.test.mjs` (Node 24+), gồm response CardSight
  giả lập, render form và submit qua backend stub; không tốn lượt scan thật.
