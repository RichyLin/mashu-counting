-- ================================================================
-- 迁移：新增备战席（bench-left / bench-right）
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- ================================================================

-- 1. 修改 players.seat 字段的 check 约束
--    旧约束：('top', 'left', 'right', 'bottom')
--    新约束：增加 bench-left 和 bench-right

alter table players
  drop constraint if exists players_seat_check;

alter table players
  add constraint players_seat_check
  check (seat in ('top', 'left', 'right', 'bottom', 'bench-left', 'bench-right'));

-- 2. 替换 perform_pool_collect RPC，加入备战席拦截
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

grant execute on function perform_pool_collect to anon;
