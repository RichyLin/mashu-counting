import { supabase } from './supabase'

// 座位分配顺序：前4人入桌，第5/6人入备战席
const SEAT_ORDER = ['bottom', 'top', 'left', 'right', 'bench-left', 'bench-right']

// ── 房间 ──────────────────────────────────────────────────────

export async function getActiveRoom(code) {
  const { data } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle()
  return data ?? null
}

export async function getOrCreateRoom(code, deviceId) {
  const { data: existing } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) return { data: existing, error: null }

  const { data: created, error: createErr } = await supabase
    .from('rooms')
    .insert({ code, host_device_id: deviceId })
    .select()
    .single()

  if (!createErr) return { data: created, error: null }

  // 唯一约束冲突：房间已存在（并发或网络抖动导致第一次查询漏掉），重试查找
  const { data: retry, error: retryErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle()

  return { data: retry ?? null, error: retry ? null : retryErr }
}

export async function getRoom(roomId) {
  return supabase.from('rooms').select('*').eq('id', roomId).single()
}

export async function updateInitScore(roomId, score) {
  return supabase.from('rooms').update({ init_score: score }).eq('id', roomId)
}

export async function dissolveRoom(roomId) {
  return supabase.from('rooms').update({ status: 'dissolved' }).eq('id', roomId)
}

// ── 玩家 ──────────────────────────────────────────────────────

export async function getPlayerByDevice(roomId, deviceId) {
  return supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .eq('device_id', deviceId)
    .maybeSingle()
}

export async function getPlayerById(playerId) {
  return supabase.from('players').select('*').eq('id', playerId).maybeSingle()
}

export async function getPlayers(roomId) {
  return supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at')
}

export async function getAvailableSeat(roomId) {
  const { data: players } = await getPlayers(roomId)
  const taken = new Set(players?.map(p => p.seat) ?? [])
  return SEAT_ORDER.find(s => !taken.has(s)) ?? null
}

export async function createPlayer(roomId, deviceId, name, emoji, seat, initScore) {
  return supabase
    .from('players')
    .insert({ room_id: roomId, device_id: deviceId, name, emoji, seat, score: initScore })
    .select()
    .single()
}

export async function setPlayerOnline(playerId, isOnline) {
  return supabase
    .from('players')
    .update({ is_online: isOnline, last_seen_at: new Date().toISOString() })
    .eq('id', playerId)
}

export async function kickPlayer(playerId) {
  return supabase.from('players').delete().eq('id', playerId)
}

// ── 公池 ──────────────────────────────────────────────────────

export async function getPool(roomId) {
  return supabase.from('room_pool').select('*').eq('room_id', roomId).single()
}

// ── 交易记录 ──────────────────────────────────────────────────

export async function getTransactions(roomId) {
  return supabase
    .from('transactions')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(200)
}

// ── RPC 操作（原子） ──────────────────────────────────────────

export async function transfer(roomId, fromId, toId, amount, description) {
  return supabase.rpc('perform_transfer', {
    p_room_id: roomId, p_from_id: fromId, p_to_id: toId,
    p_amount: amount, p_description: description,
  })
}

export async function payPool(roomId, playerId, description) {
  return supabase.rpc('perform_pool_pay', {
    p_room_id: roomId, p_player_id: playerId, p_description: description,
  })
}

export async function collectPool(roomId, playerId, description) {
  return supabase.rpc('perform_pool_collect', {
    p_room_id: roomId, p_player_id: playerId, p_description: description,
  })
}

export async function revokeTransaction(roomId, txId) {
  return supabase.rpc('perform_revoke', { p_room_id: roomId, p_tx_id: txId })
}

export async function resetRoom(roomId, initScore) {
  return supabase.rpc('perform_reset', { p_room_id: roomId, p_init_score: initScore })
}
