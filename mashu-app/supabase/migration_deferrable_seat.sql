-- ================================================================
-- 迁移：players (room_id, seat) 唯一约束改为 DEFERRABLE
-- 原因：perform_swap 需要在一个事务里交换两人座位，
--       IMMEDIATE 约束导致第一行更新时就冲突报错
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ================================================================

-- 1. 将唯一约束改为 DEFERRABLE INITIALLY IMMEDIATE
--    默认行为不变，但允许在事务内手动推迟检查
ALTER TABLE players DROP CONSTRAINT players_room_id_seat_key;
ALTER TABLE players ADD CONSTRAINT players_room_id_seat_key
  UNIQUE (room_id, seat) DEFERRABLE INITIALLY IMMEDIATE;

-- 2. 更新 perform_swap：在函数内推迟约束检查，两行都更新完再校验
CREATE OR REPLACE FUNCTION perform_swap(
  p_player_a uuid,
  p_player_b uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seat_a text;
  v_seat_b text;
BEGIN
  SELECT seat INTO v_seat_a FROM players WHERE id = p_player_a;
  SELECT seat INTO v_seat_b FROM players WHERE id = p_player_b;

  -- 推迟唯一约束检查到事务提交时，避免中间状态冲突
  SET CONSTRAINTS players_room_id_seat_key DEFERRED;

  UPDATE players SET seat = v_seat_b WHERE id = p_player_a;
  UPDATE players SET seat = v_seat_a WHERE id = p_player_b;
END;
$$;

GRANT EXECUTE ON FUNCTION perform_swap TO anon;
