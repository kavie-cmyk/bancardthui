-- =====================================================================
-- Bán Card Thui — STOREFRONT công khai (chạy 1 lần trong SQL Editor)
-- ---------------------------------------------------------------------
-- Nguyên tắc an toàn: KHÔNG mở RLS của các bảng gốc (cards / listings /
-- inventory_lots / orders vẫn khóa hoàn toàn với người chưa đăng nhập).
-- Chỉ tạo 1 VIEW chứa đúng các cột khách được xem, lọc sẵn status =
-- 'active'. View chạy bằng quyền của owner nên đọc được dữ liệu, còn
-- khách (anon) chỉ có quyền SELECT trên view này — không thấy giá vốn,
-- không thấy lô/đơn, không thấy tin rao nháp/ẩn/đã bán.
-- =====================================================================

create or replace view public.storefront_listings as
select
  l.id          as listing_id,
  l.price,
  l.qty,
  l.channel,
  l.created_at,
  c.id          as card_id,
  c.name,
  c."set"       as set_name,
  c.set_id,
  c.number,
  c.rarity,
  c.language,
  c.condition   as card_condition,
  c.graded_org,
  c.graded_score,
  lot.variant,
  lot.holo_pattern,
  lot.condition as lot_condition,
  (select ci.url
     from public.card_images ci
    where ci.card_id = c.id
    order by ci.sort_order, ci.id
    limit 1)    as photo_url
from public.listings l
join public.cards c
  on c.id = l.card_id
left join public.inventory_lots lot
  on lot.id = l.lot_id
where l.status = 'active';

grant select on public.storefront_listings to anon, authenticated;

-- Kiểm chứng nhanh sau khi chạy (đều phải đúng):
--   select count(*) from public.storefront_listings;  → chỉ đếm tin 'active'
--   (REST bằng anon key) /rest/v1/storefront_listings → trả các tin active
--   (REST bằng anon key) /rest/v1/listings            → vẫn trả [] (khóa)
