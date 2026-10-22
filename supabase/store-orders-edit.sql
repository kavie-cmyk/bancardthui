-- =====================================================================
-- Bán Card Thui — SỬA ĐƠN WEB + KHÁCH TRA CỨU TRẠNG THÁI ĐƠN
-- (chạy 1 lần trong SQL Editor, sau store-orders.sql)
-- ---------------------------------------------------------------------
-- 1) store_orders thêm cột shipping_fee (Zac sửa đơn sau khi trao đổi
--    với khách: giá từng lá nằm trong items, ship nằm riêng ở đây).
-- 2) Hàm track_store_order(code, phone): khách tra cứu trên storefront.
--    CHỈ trả dữ liệu khi khớp CẢ mã đơn (id đầy đủ hoặc 8 ký tự đầu)
--    VÀ số điện thoại đã đặt, và chỉ khi khớp đúng 1 đơn. Hàm chạy
--    security definer nên đọc được bảng, nhưng bảng store_orders vẫn
--    khóa hoàn toàn với anon như cũ (không SELECT trực tiếp được).
-- =====================================================================

alter table public.store_orders
  add column if not exists shipping_fee integer not null default 0;

create or replace function public.track_store_order(p_code text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.store_orders%rowtype;
  n int;
begin
  if p_code is null or p_phone is null or length(trim(p_code)) = 0 then
    return null;
  end if;
  select count(*) into n
    from public.store_orders
   where phone = p_phone
     and (id::text = lower(trim(p_code)) or left(id::text, 8) = lower(trim(p_code)));
  if n <> 1 then
    return null;
  end if;
  select * into r
    from public.store_orders
   where phone = p_phone
     and (id::text = lower(trim(p_code)) or left(id::text, 8) = lower(trim(p_code)))
   limit 1;
  return jsonb_build_object(
    'code', left(r.id::text, 8),
    'status', r.status,
    'customer_name', r.customer_name,
    'items', r.items,
    'total', r.total,
    'shipping_fee', r.shipping_fee,
    'created_at', r.created_at
  );
end;
$$;

grant execute on function public.track_store_order(text, text) to anon, authenticated;
