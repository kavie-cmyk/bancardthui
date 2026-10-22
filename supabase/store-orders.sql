-- =====================================================================
-- Bán Card Thui — ĐƠN ĐẶT HÀNG TỪ STOREFRONT (chạy 1 lần trong SQL Editor)
-- ---------------------------------------------------------------------
-- Mô hình: khách đặt trên store.html → 1 dòng trong store_orders
-- (status='new'). Đơn web KHÔNG trừ kho — Zac xem trong app kho
-- (mục "Đơn từ web"), xác nhận rồi mới chuyển thành đơn bán thật.
--
-- An toàn:
-- * RLS bật. Khách (anon) CHỈ có quyền INSERT với status='new' —
--   không đọc/sửa/xóa được đơn của bất kỳ ai (kể cả đơn mình vừa gửi,
--   nên client phải POST với Prefer: return=minimal).
-- * Tài khoản app kho (authenticated) toàn quyền để xử lý đơn.
-- =====================================================================

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text not null,
  note text not null default '',
  items jsonb not null default '[]',  -- [{listing_id, card_id, name, price, qty}]
  total integer not null default 0,   -- VND, tổng tiền hàng (chưa gồm ship)
  status text not null default 'new' check (status in ('new','done','cancelled')),
  converted_order_id uuid,             -- id đơn bán thật sau khi xác nhận
  created_at timestamptz not null default now()
);

alter table public.store_orders enable row level security;

drop policy if exists "store orders public insert" on public.store_orders;
create policy "store orders public insert" on public.store_orders
  for insert to anon with check (status = 'new');

drop policy if exists "store orders staff all" on public.store_orders;
create policy "store orders staff all" on public.store_orders
  for all to authenticated using (true) with check (true);

-- Kênh bán 'website' cho đơn thật được chuyển từ đơn web
alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders add constraint orders_channel_check
  check (channel in ('ebay','shopee','facebook','tructiep','website'));
