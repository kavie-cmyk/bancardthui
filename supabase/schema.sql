-- Bán Card Thui — schema Supabase (Phase 2: web bán hàng đọc chung DB)
-- Chạy trong Supabase SQL Editor. Bản localStorage hiện tại map 1-1 sang schema này.

-- ============ TABLES ============
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "set" text,
  set_id text,               -- tcgdex set id, vd 'sv03.5' (để tra tổng số lá/năm phát hành)
  number text,               -- số thứ tự trong set, vd '025'
  rarity text,
  condition text not null default 'A' check (condition in ('New Mint','A','B','C','D')),
  graded_org text,            -- 'PSA' | 'BGS' | null
  graded_score text,
  cert_number text default '',  -- mã cert PSA/BGS
  cert_pop integer,             -- pop report: số lá cùng điểm
  language text not null default 'en' check (language in ('en','jp','other')),
  storage_location text default '',  -- vị trí cất: "Hộp A3", "Binder 2 - trang 15"
  misprint boolean not null default false,  -- flag lỗi in
  market_price numeric,           -- giá tham khảo chốt (đã quy đổi theo condition)
  market_currency text default 'EUR',
  market_source text default '',
  market_updated_at timestamptz,
  price_sources jsonb default '[]',
  -- price_sources: [{source:'cardmarket'|'tcgplayer'|'ebay'|'other', price, currency, kind, updated_at}]
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_cards_name on cards (name);
create index if not exists idx_cards_set on cards (set_id);

-- Tổng số lá do user nhập tay cho set không có trong danh sách chuẩn
-- (bản local lưu ở state.setTotals; khi lên Supabase có thể đưa vào bảng này)
create table if not exists set_totals (
  set_key text primary key,  -- set_id hoặc tên set
  total integer not null check (total > 0),
  updated_at timestamptz not null default now()
);

-- Set do user tự tạo (bản local: state.customSets). 220 set TCGdex chỉ đọc, không lưu DB.
create table if not exists custom_sets (
  id text primary key,       -- 'custom-<rand>', khớp card.set_id
  name text not null,
  total integer not null check (total > 0),
  official integer not null check (official > 0 and official <= total),
  year integer,              -- năm phát hành, null nếu không rõ
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_custom_sets_name on custom_sets (name);

-- Mỗi lần nhập = 1 lô. Giá cost & ngày nhập giữ riêng từng lô để tính FIFO.
create table if not exists inventory_lots (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  qty integer not null check (qty > 0),
  qty_remaining integer not null check (qty_remaining >= 0),
  cost_per_unit integer not null check (cost_per_unit >= 0),  -- VND
  import_date date not null,
  source text default '',
  condition text not null default 'A',
  variant text not null default 'Normal' check (variant in ('Normal','Reverse Holo','Holo','1st Edition')),
  holo_pattern text,  -- mẫu màng holo: Cosmos | Cosmos Swirl | Poké Ball | Master Ball | Mirror | Cracked Ice | Confetti | Khác
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

-- ============ Cài đặt chung của app kho (đồng bộ giữa các thiết bị) ============
-- Đồng bộ API key CardSight cho TOÀN BỘ tài khoản đăng nhập được app kho:
-- key là của shop, lưu ở một dòng cố định (user_id =
-- '00000000-0000-0000-0000-0000000000a1'), tài khoản nào đăng nhập cũng
-- đọc/ghi chung dòng đó (PC/điện thoại giống nhau). Người chưa đăng nhập
-- (anon) không có quyền gì trên bảng này.
create table if not exists user_settings (
  user_id uuid primary key,
  cardsight_keys jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table user_settings enable row level security;
drop policy if exists "own settings" on user_settings;
drop policy if exists "store shared settings" on user_settings;
create policy "store shared settings" on user_settings
  for all to authenticated
  using (true)
  with check (true);

-- ============ FIFO trong SQL (tham khảo) ============
-- Lấy các lô còn hàng của 1 card, cũ nhất trước:
-- select * from inventory_lots
--  where card_id = $1 and qty_remaining > 0
--  order by import_date, created_at;
