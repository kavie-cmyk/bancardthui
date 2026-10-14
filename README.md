# Bán Card Thui — Quản lý kho Pokémon TCG

Web app quản lý kho card Pokémon cá nhân: nhập kho theo lô, bán hàng trừ kho FIFO,
dashboard lãi/lỗ thực tế. Chạy ngay không cần build step.

## Cách chạy

Mở `index.html` bằng trình duyệt (double-click hoặc kéo vào Chrome).
Lần đầu mở, app tự nạp **dữ liệu mẫu** (8 card, 10 đơn) để xem dashboard sống ngay.
Nút **"Xóa dữ liệu mẫu"** trên thanh header để bắt đầu kho trống.

> Cần internet cho Google Fonts. Không có mạng vẫn chạy, chỉ rớt về font hệ thống.

## Data model (localStorage key `bct_state_v1`)

| Bảng | Trường chính |
|---|---|
| `cards` | id, name, set, setId (tcgdex), number, rarity, condition (NM/LP/MP), graded {org, score}, images[] (dataURL), note |
| `lots` (inventory_lots) | id, cardId, qty, qtyRemaining, costPerUnit (VND), importDate, source |
| `orders` | id, date, channel (ebay/shopee/facebook/tructiep), items[] {cardId, lotId, qty, sellPrice, costPerUnit}, fees, shippingFee, buyer, note |
| `setTotals` | {setKey: total} — tổng số lá do user nhập tay cho set không có trong danh sách chuẩn |

`listings` (rao bán) chưa có UI — dành cho Phase 2, schema đã có trong `supabase/schema.sql`.

## Bộ sưu tập theo set (view "Bộ sưu tập")

- Danh sách 220 set lấy từ [TCGdex](https://api.tcgdex.net/v2/en/sets) (`js/sets-db.js`, snapshot 2026-10-14), mỗi set có tổng số lá, số lá chính thức và năm phát hành.
- Mỗi set hiện progress bar **số lá unique còn hàng ÷ tổng số lá**, số lá thiếu, tổng thẻ tồn, giá trị kho ước tính.
- Bấm vào set → **checklist** đánh số 1..tổng: lá đã có sáng + badge số lượng, lá thiếu mờ đi; lá có số vượt số lá chính thức gắn tag **SECRET**.
- Set không tra được tổng số lá → nhập tay ngay trên thẻ set (lưu vào `setTotals`).
- Filter theo năm phát hành + chế độ **nhóm theo năm** (mới → cũ).
- Nút **?** ở đầu trang Kho giải thích ký hiệu độ hiếm (● ◆ ★ …) bằng tiếng Việt.

### Phiên bản in & checklist 2 chế độ

- Mỗi lô nhập có **phiên bản**: Normal / Reverse Holo / Holo / 1st Edition (chọn lúc nhập kho; dữ liệu cũ mặc định Normal).
- Tiến độ set tính theo chuẩn **complete set**: 1 số thứ tự chỉ tính 1 lần dù có nhiều bản trùng (badge ×N hiện tổng số bản).
- Checklist có toggle **Set chuẩn / Master**: Master hiện breakdown phiên bản từng ô (vd "Reverse Holo ×2 · Holo ×1") mà không đổi cách tính tiến độ.
- Bấm vào ô đã có → panel: xem card đang chiếm ô + variant, nút **Sửa lá**, form **Đổi số/set** (đổi số thứ tự, set, độ hiếm — lô & đơn giữ nguyên), **Gỡ khỏi set**.
- Ô trống có nút **+ thêm** → mở Nhập kho đã điền sẵn set + số thứ tự.

## FIFO — logic cốt lõi

- Mỗi lần nhập = **1 lô riêng** (giá cost + ngày nhập của lô đó).
- Bán hàng trừ lô **cũ nhất trước** (`consumeFIFO` trong `js/store.js`), ném lỗi nếu không đủ hàng — không bao giờ âm kho.
- Lãi/đơn = Σ(qty × giá bán) − Σ(qty × cost lô thực tế) − phí sàn − phí ship.
- Form Bán hàng có **xem trước FIFO**: hiện sẽ trừ lô nào, cost bao nhiêu, trước khi xác nhận.

## Lưu ý localStorage

- Ảnh card được **nén còn ~800px JPEG q0.8** khi upload → mỗi ảnh ~60–150KB.
- localStorage giới hạn **~5MB** → chứa được vài chục card có ảnh. Vượt giới hạn app sẽ báo lỗi khi lưu.
- Dữ liệu chỉ nằm trên trình duyệt này. Muốn dùng nhiều máy → chuyển sang Supabase (schema sẵn trong `supabase/schema.sql`).

## Cấu trúc file

```
index.html            Khung app + nav
css/style.css         Theme "collector's vault" (dark ink + amber, grain, foil)
js/store.js           State, FIFO, tính toán (dùng được cả trong Node để test)
js/seed.js            Dữ liệu mẫu (dùng đúng logic FIFO thật nên số liệu nhất quán)
js/app.js             Router + 5 views: Tổng quan / Kho / Nhập kho / Bán hàng / Đơn hàng
supabase/schema.sql   Schema Supabase cho Phase 2 (cards, inventory_lots, listings, orders, card_images)
```

## Roadmap Phase 2 — web bán hàng

1. Tạo project Supabase, chạy `supabase/schema.sql`, tạo bucket `card-images` (public).
2. Viết script migrate 1 lần: đọc `localStorage.bct_state_v1` → insert vào Supabase.
3. Web bán hàng (storefront) đọc bảng `listings` + `card_images`, đơn mới ghi vào `orders` — app quản lý này chuyển sang đọc/ghi Supabase thay vì localStorage (giữ nguyên `js/store.js` interface, chỉ thay lớp persistence).
