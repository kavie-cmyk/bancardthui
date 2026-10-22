-- =====================================================================
-- Bán Card Thui — TIẾN ĐỘ ĐƠN BÁN + SỬA ĐƠN SAU KHI TẠO
-- (chạy 1 lần trong SQL Editor, sau store-orders-track-or.sql)
-- ---------------------------------------------------------------------
-- 1) orders thêm cột status: new (Chờ xác nhận) → confirmed (Đã xác
--    nhận) → packing (Đang đóng gói) → shipping (Đang vận chuyển) →
--    done (Hoàn thành); cancelled (Đã hủy). Đơn cũ mặc định 'done'
--    (đều là đơn đã bán xong trong quá khứ); app tạo đơn mới với 'new'.
-- 2) track_store_orders: nếu đơn web đã được chuyển thành đơn bán
--    (converted_order_id), trả thêm order_status để khách thấy tiến độ
--    thật trên store. Còn lại giữ nguyên bản tra cứu HOẶC mã/SĐT.
-- =====================================================================

alter table public.orders
  add column if not exists status text not null default 'done';

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'confirmed', 'packing', 'shipping', 'done', 'cancelled'));

create or replace function public.track_store_orders(p_code text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(x order by x_created desc), '[]'::jsonb)
    into result
    from (
      select jsonb_build_object(
               'code', left(o.id::text, 8),
               'status', o.status,
               'order_status', (select os.status from public.orders os where os.id = o.converted_order_id),
               'customer_name', o.customer_name,
               'items', o.items,
               'total', o.total,
               'shipping_fee', o.shipping_fee,
               'created_at', o.created_at
             ) as x,
             o.created_at as x_created
        from public.store_orders o
       where (
               (p_code is not null and length(trim(p_code)) > 0
                and (o.id::text = lower(trim(p_code)) or left(o.id::text, 8) = lower(trim(p_code))))
               or
               ((p_code is null or length(trim(p_code)) = 0)
                and p_phone is not null and length(trim(p_phone)) > 0
                and o.phone = p_phone)
             )
       order by o.created_at desc
       limit 20
    ) t;
  return result;
end;
$$;

grant execute on function public.track_store_orders(text, text) to anon, authenticated;
