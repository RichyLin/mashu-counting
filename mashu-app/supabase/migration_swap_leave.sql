-- ================================================================
-- 迁移：新增 perform_swap / perform_move_seat / perform_leave RPC
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- ================================================================

-- 换座（两人互换，单条 UPDATE 保证原子性）
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

-- 移动到空位
create or replace function perform_move_seat(
  p_player_id uuid,
  p_new_seat  text
) returns void language plpgsql security definer as $$
begin
  update players set seat = p_new_seat where id = p_player_id;
end;
$$;

-- 退出房间（含房主转让 / 解散逻辑）
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

grant execute on function perform_swap      to anon;
grant execute on function perform_move_seat to anon;
grant execute on function perform_leave     to anon;
