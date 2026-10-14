-- Bán Card Thui — schema Supabase (Phase 2: web bán hàng đọc chung DB)
-- Chạy trong Supabase SQL Editor. Bản localStorage hiện tại map 1-1 sang schema này.

-- ============ TABLES ============
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "set" text,
  number text,
  rarity text,
  condition text not null default 'NM' check (condition in ('NM','LP','MP')),
  graded_org text,            -- 'PSA' | 'BGS' | null
  graded_score text,
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_cards_name on cards (name);

-- Mỗi lần nhập = 1 lô. Giá cost & ngày nhập giữ riêng từng lô để tính FIFO.
create table if not exists inventory_lots (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  qty integer not null check (qty > 0),
  qty_remaining integer not null check (qty_remaining >= 0),
  cost_per_unit integer not null check (cost_per_unit >= 0),  -- VND
  import_date date not null,
  source text default '',
  condition text not null default 'NM',
  created_at timestamptz not null default now()
);
create index if not exists idx_lots_card_fifo on inventory_lots (card_id, import_date, created_at);

-- Card đang rao bán (Phase 2: storefront đọc bảng này)
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  lot_id uuid references inventory_lots(id) on delete set null,
  price integer not null check (price >= 0),                 -- VND, giá rao
  qty integer not null default 1 check (qty > 0),
  status text not null default 'draft' check (status in ('draft','active','sold','hidden')),
  channel text,              -- 'ebay' | 'shopee' | 'facebook' | 'tructiep'
  created_at timestamptz not null default now()
);
create index if not exists idx_listings_status on listings (status);

-- Đơn bán. Mỗi item snapshot đúng lô đã trừ (FIFO) + cost thực tế tại thời điểm bán.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  channel text not null check (channel in ('ebay','shopee','facebook','tructiep')),
  items jsonb not null default '[]',
  -- items: [{ card_id uuid, lot_id uuid, qty int, sell_price int, cost_per_unit int }]
  fees integer not null default 0,          -- phí sàn, VND
  shipping_fee integer not null default 0,  -- VND
  buyer text default '',
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_orders_date on orders (date);

-- ============ STORAGE (ảnh card) ============
-- Tạo bucket tên `card-images` (public) trong Storage, rồi chạy policy:
-- insert into storage.buckets (id, name, public) values ('card-images','card-images', true)
--   on conflict (id) do nothing;
--
-- create policy "public read" on storage.objects for select
--   using (bucket_id = 'card-images');
-- create policy "owner write" on storage.objects for insert
--   with check (bucket_id = 'card-images');
--
-- Bảng phụ lưu URL ảnh (thay cho mảng images[] trong localStorage):
create table if not exists card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0
);

-- ============ RLS (bật khi dùng thật) ============
-- alter table cards enable row level security;
-- alter table inventory_lots enable row level security;
-- alter table listings enable row level security;
-- alter table orders enable row level security;
-- alter table card_images enable row level security;
-- (Tạo policy theo nhu cầu: app cá nhân có thể dùng service_role ở server,
--  hoặc anon key + policy giới hạn theo auth.uid().)

-- ============ FIFO trong SQL (tham khảo) ============
-- Lấy các lô còn hàng của 1 card, cũ nhất trước:
-- select * from inventory_lots
--  where card_id = $1 and qty_remaining > 0
--  order by import_date, created_at;
