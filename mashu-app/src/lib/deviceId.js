const KEY = 'mashu_device_id'

export function getDeviceId() {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

export function getStoredPlayerId(roomCode) {
  return localStorage.getItem(`mashu_player_${roomCode}`) ?? null
}

export function storePlayerId(roomCode, playerId) {
  localStorage.setItem(`mashu_player_${roomCode}`, playerId)
}

export function clearStoredPlayer(roomCode) {
  localStorage.removeItem(`mashu_player_${roomCode}`)
}
