-- =====================================================================
-- Bán Card Thui — STOREFRONT HIỆN SỐ BÁN ĐƯỢC THEO TỒN KHO THẬT
-- (chạy 1 lần trong SQL Editor, sau storefront.sql)
-- ---------------------------------------------------------------------
-- Vấn đề (Zac phát hiện 22/10): tin rao hiện qty do người bán gõ tay,
-- còn đơn bán trừ vào lô hàng thật — bán hết rồi store vẫn báo còn.
-- Bản mới: qty khách thấy = MIN(qty rao, tồn kho thật của card — hoặc
-- của đúng lô nếu tin rao gắn 1 lô cụ thể); tồn thật = 0 thì tin TỰ
-- BIẾN MẤT khỏi store. Hủy đơn (hoàn kho) / nhập thêm → tự hiện lại.
-- Các cột và quyền giữ nguyên như view cũ.
-- =====================================================================
-- LƯU Ý khi chạy: phải DROP view cũ trước (sum() trả bigint, CREATE OR
-- REPLACE không cho đổi kiểu cột qty integer → bigint, lỗi 42P16).
-- =====================================================================

drop view if exists public.storefront_listings;

create view public.storefront_listings as
select
  l.id          as listing_id,
  l.price,
  least(l.qty, coalesce(stock.qty, 0)) as qty,
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
left join lateral (
  select sum(il.qty_remaining) as qty
    from public.inventory_lots il
   where il.card_id = l.card_id
     and (l.lot_id is null or il.id = l.lot_id)
) stock on true
where l.status = 'active'
  and least(l.qty, coalesce(stock.qty, 0)) > 0;

grant select on public.storefront_listings to anon, authenticated;
