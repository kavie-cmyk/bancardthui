-- =====================================================================
-- Bán Card Thui — TRA CỨU ĐƠN BẰNG MÃ ĐƠN *HOẶC* SỐ ĐIỆN THOẠI
-- (chạy 1 lần trong SQL Editor, sau store-orders-edit.sql)
-- ---------------------------------------------------------------------
-- Zac chốt 2026-10-22: khách tra cứu chỉ cần 1 trong 2 — mã đơn hoặc
-- SĐT đã đặt (không cần cả hai). Tra bằng SĐT trả TẤT CẢ đơn của số đó
-- (tối đa 20 đơn gần nhất). Hàm mới track_store_orders (số nhiều) thay
-- thế track_store_order cũ và TRẢ VỀ MẢNG jsonb.
-- Bảng store_orders vẫn khóa hoàn toàn với anon như cũ.
-- =====================================================================

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

-- Hàm cũ (bắt buộc cả mã + SĐT) không còn dùng nữa.
drop function if exists public.track_store_order(text, text);
