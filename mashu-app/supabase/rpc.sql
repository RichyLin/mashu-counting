-- ================================================================
-- 麻薯计分 — RPC 函数（原子性操作）
-- 在 schema.sql 执行完成后，继续在 SQL Editor 中执行此文件
-- ================================================================

-- ── 转账 ──────────────────────────────────────────────────────
create or replace function perform_transfer(
  p_room_id     uuid,
  p_from_id     uuid,
  p_to_id       uuid,
  p_amount      integer,
  p_description text default null
) returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into transactions(room_id, type, from_player_id, to_player_id, amount, description)
  values (p_room_id, 'transfer', p_from_id, p_to_id, p_amount, p_description)
  returning id into v_id;

  update players set score = score - p_amount where id = p_from_id;
  update players set score = score + p_amount where id = p_to_id;
  return v_id;
end;
$$;

-- ── 交公池 ────────────────────────────────────────────────────
create or replace function perform_pool_pay(
  p_room_id     uuid,
  p_player_id   uuid,
  p_description text default null
) returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into transactions(room_id, type, from_player_id, amount, description)
  values (p_room_id, 'pool_pay', p_player_id, 1, p_description)
  returning id into v_id;

  update players  set score = score - 1                    where id = p_player_id;
  update room_pool set score = score + 1, updated_at = now() where room_id = p_room_id;
  return v_id;
end;
$$;

-- ── 收公池 ────────────────────────────────────────────────────
create or replace function perform_pool_collect(
  p_room_id     uuid,
  p_player_id   uuid,
  p_description text default null
) returns uuid language plpgsql security definer as $$
declare
  v_id         uuid;
  v_pool_score integer;
  v_seat       text;
begin
  select seat into v_seat from players where id = p_player_id;
  if v_seat in ('bench-left', 'bench-right') then
    raise exception '备战席玩家不可收公池';
  end if;

  select score into v_pool_score from room_pool where room_id = p_room_id;
  if v_pool_score is null or v_pool_score <= 0 then
    raise exception '公池为空';
  end if;

  insert into transactions(room_id, type, from_player_id, amount, description)
  values (p_room_id, 'pool_collect', p_player_id, v_pool_score, p_description)
  returning id into v_id;

  update players  set score = score + v_pool_score          where id = p_player_id;
  update room_pool set score = 0, updated_at = now()         where room_id = p_room_id;
  return v_id;
end;
$$;

-- ── 撤回 ──────────────────────────────────────────────────────
create or replace function perform_revoke(
  p_room_id uuid,
  p_tx_id   uuid
) returns uuid language plpgsql security definer as $$
declare
  v_tx     transactions%rowtype;
  v_new_id uuid;
begin
  select * into v_tx from transactions
  where id = p_tx_id and room_id = p_room_id;

  if not found         then raise exception '记录不存在'; end if;
  if v_tx.revoked      then raise exception '已被撤回'; end if;
  if v_tx.type = 'revoke' then raise exception '撤回记录不可再撤回'; end if;

  -- 标记原记录为已撤回
  update transactions set revoked = true where id = p_tx_id;

  -- 反向恢复分数
  if v_tx.type = 'transfer' then
    update players set score = score + v_tx.amount where id = v_tx.from_player_id;
    update players set score = score - v_tx.amount where id = v_tx.to_player_id;
  elsif v_tx.type = 'pool_pay' then
    update players  set score = score + 1              where id = v_tx.from_player_id;
    update room_pool set score = score - 1, updated_at = now() where room_id = p_room_id;
  elsif v_tx.type = 'pool_collect' then
    update players  set score = score - v_tx.amount    where id = v_tx.from_player_id;
    update room_pool set score = v_tx.amount, updated_at = now() where room_id = p_room_id;
  end if;

  -- 插入撤回记录
  insert into transactions(room_id, type, from_player_id, to_player_id, amount, description, revoke_of)
  values (p_room_id, 'revoke', v_tx.from_player_id, v_tx.to_player_id, v_tx.amount,
          '【撤回】' || coalesce(v_tx.description, ''), p_tx_id)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ── 重置房间 ──────────────────────────────────────────────────
create or replace function perform_reset(
  p_room_id    uuid,
  p_init_score integer
) returns void language plpgsql security definer as $$
begin
  update players   set score = p_init_score            where room_id = p_room_id;
  update room_pool set score = 0, updated_at = now()   where room_id = p_room_id;
  insert into transactions(room_id, type, amount, description)
  values (p_room_id, 'reset', 0, '房间已重置');
end;
$$;

-- ── 换座（两人互换）─────────────────────────────────────────────
-- 使用单条 UPDATE + CASE 保证原子性，规避唯一约束冲突
create or replace function perform_swap(
  p_player_a uuid,
  p_player_b uuid
) returns void language plpgsql security definer as $$
declare
  v_seat_a text;
  v_seat_b text;
begin
  select seat into v_seat_a from players where id = p_player_a;
  select seat into v_seat_b from players where id = p_player_b;
  update players
    set seat = case id when p_player_a then v_seat_b else v_seat_a end
    where id in (p_player_a, p_player_b);
end;
$$;

-- ── 移动到空位 ────────────────────────────────────────────────
create or replace function perform_move_seat(
  p_player_id uuid,
  p_new_seat  text
) returns void language plpgsql security definer as $$
begin
  update players set seat = p_new_seat where id = p_player_id;
end;
$$;

-- ── 退出房间（含房主转让 / 解散逻辑）────────────────────────────
create or replace function perform_leave(
  p_room_id   uuid,
  p_player_id uuid
) returns void language plpgsql security definer as $$
declare
  v_device_id      text;
  v_is_host        boolean;
  v_next_device_id text;
  v_others_count   integer;
begin
  select device_id into v_device_id from players where id = p_player_id;
  select (host_device_id = v_device_id) into v_is_host from rooms where id = p_room_id;
  select count(*) into v_others_count
    from players where room_id = p_room_id and id != p_player_id;

  if v_is_host then
    if v_others_count = 0 then
      update rooms set status = 'dissolved' where id = p_room_id;
    else
      select device_id into v_next_device_id
        from players
        where room_id = p_room_id and id != p_player_id
        order by joined_at asc limit 1;
      update rooms set host_device_id = v_next_device_id where id = p_room_id;
    end if;
  end if;

  delete from players where id = p_player_id;
end;
$$;

-- ── 授权 anon 调用 ─────────────────────────────────────────────
grant execute on function perform_transfer    to anon;
grant execute on function perform_pool_pay    to anon;
grant execute on function perform_pool_collect to anon;
grant execute on function perform_revoke      to anon;
grant execute on function perform_reset       to anon;
grant execute on function perform_swap        to anon;
grant execute on function perform_move_seat   to anon;
grant execute on function perform_leave       to anon;
