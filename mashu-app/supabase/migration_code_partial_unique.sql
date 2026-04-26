-- ================================================================
-- 迁移：rooms.code 改为局部唯一索引（仅 active 房间唯一）
-- 问题：旧全局唯一约束导致 dissolved 房间占用号码，
--       相同号码无法再次创建新房间
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ================================================================

-- 1. 删除旧的全局唯一约束
ALTER TABLE rooms DROP CONSTRAINT rooms_code_key;

-- 2. 新建局部唯一索引：只有 status = 'active' 的房间才要求 code 唯一
--    dissolved 房间不参与唯一性校验，同一号码可被多次复用
CREATE UNIQUE INDEX rooms_code_active_unique ON rooms (code) WHERE status = 'active';
