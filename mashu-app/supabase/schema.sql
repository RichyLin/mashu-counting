-- ================================================================
-- 麻薯计分 — Supabase 数据库建表脚本
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- ================================================================

-- UUID 扩展（Supabase 默认已开启，保险起见保留）
create extension if not exists "uuid-ossp";

-- ================================================================
-- 1. ROOMS — 房间
-- ================================================================
create table if not exists rooms (
  id             uuid primary key default uuid_generate_v4(),
  code           char(4)     not null unique,                  -- 4位房间号
  host_device_id text        not null,                         -- 房主设备ID
  init_score     integer     not null default 200,             -- 初始分数
  status         text        not null default 'active'
                             check (status in ('active', 'dissolved')),
  last_active_at timestamptz not null default now(),           -- 最后操作时间（用于2小时超时）
  created_at     timestamptz not null default now()
);

-- ================================================================
-- 2. PLAYERS — 玩家
-- ================================================================
create table if not exists players (
  id           uuid primary key default uuid_generate_v4(),
  room_id      uuid        not null references rooms(id) on delete cascade,
  device_id    text        not null,                           -- localStorage 设备ID
  name         varchar(6)  not null,
  emoji        text        not null default '🍡',
  seat         text        not null
               check (seat in ('top', 'left', 'right', 'bottom')),
  score        integer     not null default 200,
  is_online    boolean     not null default true,
  last_seen_at timestamptz not null default now(),
  joined_at    timestamptz not null default now(),

  unique (room_id, seat),        -- 同一房间每个座位只能有一人
  unique (room_id, device_id)    -- 同一设备在同一房间只有一个身份
);

-- ================================================================
-- 3. TRANSACTIONS — 交易记录
-- ================================================================
create table if not exists transactions (
  id             uuid primary key default uuid_generate_v4(),
  room_id        uuid    not null references rooms(id) on delete cascade,
  type           text    not null
                 check (type in (
                   'transfer',      -- 转账
                   'pool_pay',      -- 交公池
                   'pool_collect',  -- 收公池
                   'revoke',        -- 撤回
                   'reset'          -- 重置房间
                 )),
  from_player_id uuid    references players(id) on delete set null,  -- 付款方
  to_player_id   uuid    references players(id) on delete set null,  -- 收款方（转账）
  amount         integer not null,                -- 涉及金额（正整数）
  description    text,                            -- 展示文案，如「阿福 → 老虎」
  revoked        boolean not null default false,  -- 是否已被撤回
  revoke_of      uuid    references transactions(id) on delete set null, -- 若为撤回记录，指向原记录
  created_at     timestamptz not null default now()
);

-- ================================================================
-- 4. ROOM_POOL — 公池（每个房间一行）
-- ================================================================
create table if not exists room_pool (
  room_id    uuid    primary key references rooms(id) on delete cascade,
  score      integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ================================================================
-- 索引
-- ================================================================
create index if not exists idx_players_room       on players(room_id);
create index if not exists idx_players_device     on players(device_id);
create index if not exists idx_transactions_room  on transactions(room_id);
create index if not exists idx_transactions_time  on transactions(room_id, created_at desc);

-- ================================================================
-- 触发器：创建房间时自动初始化公池
-- ================================================================
create or replace function init_room_pool()
returns trigger language plpgsql as $$
begin
  insert into room_pool (room_id, score) values (new.id, 0);
  return new;
end;
$$;

drop trigger if exists on_room_created on rooms;
create trigger on_room_created
  after insert on rooms
  for each row execute function init_room_pool();

-- ================================================================
-- 触发器：每次写入 transactions / room_pool 时更新 last_active_at
-- ================================================================
create or replace function touch_room_activity()
returns trigger language plpgsql as $$
begin
  update rooms set last_active_at = now() where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists on_transaction_inserted on transactions;
create trigger on_transaction_inserted
  after insert on transactions
  for each row execute function touch_room_activity();

drop trigger if exists on_pool_updated on room_pool;
create trigger on_pool_updated
  after update on room_pool
  for each row execute function touch_room_activity();

-- ================================================================
-- Row Level Security（RLS）
-- 本应用无账号体系，使用 anon key 访问，以房间号作为访问控制
-- ================================================================
alter table rooms        enable row level security;
alter table players      enable row level security;
alter table transactions enable row level security;
alter table room_pool    enable row level security;

-- 允许 anon 角色对所有表进行读写（前端持有 anon key）
create policy "anon_all" on rooms        for all to anon using (true) with check (true);
create policy "anon_all" on players      for all to anon using (true) with check (true);
create policy "anon_all" on transactions for all to anon using (true) with check (true);
create policy "anon_all" on room_pool    for all to anon using (true) with check (true);

-- ================================================================
-- Realtime：开启四张表的实时推送
-- ================================================================
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table room_pool;
alter publication supabase_realtime add table rooms;
