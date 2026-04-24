import { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import * as db from '../lib/db'

// ── 座位视图旋转 ──────────────────────────────────────────────
// 顺时针顺序：bottom → right → top → left
const CW = ['bottom', 'right', 'top', 'left']

export function getViewPos(dbSeat, mySeat) {
  const diff = (CW.indexOf(dbSeat) - CW.indexOf(mySeat) + 4) % 4
  return CW[diff]
}

// ── Reducer ───────────────────────────────────────────────────
const init = {
  room: null, myPlayer: null, players: [], pool: { score: 0 },
  transactions: [], loading: true, error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload, loading: false }
    case 'UPSERT_PLAYER': {
      const p = action.payload
      const exists = state.players.some(x => x.id === p.id)
      const players = exists ? state.players.map(x => x.id === p.id ? p : x) : [...state.players, p]
      const myPlayer = p.id === state.myPlayer?.id ? p : state.myPlayer
      return { ...state, players, myPlayer }
    }
    case 'REMOVE_PLAYER':
      return { ...state, players: state.players.filter(p => p.id !== action.payload) }
    case 'SET_POOL':
      return { ...state, pool: action.payload }
    case 'PREPEND_TX':
      return { ...state, transactions: [action.payload, ...state.transactions] }
    case 'UPDATE_TX':
      return { ...state, transactions: state.transactions.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'SET_ROOM':
      return { ...state, room: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────
const RoomContext = createContext(null)

export function RoomProvider({ roomId, myPlayerId, onDissolved, children }) {
  const [state, dispatch] = useReducer(reducer, init)
  const channelRef = useRef(null)

  // 初始数据加载
  useEffect(() => {
    if (!roomId || !myPlayerId) return
    let cancelled = false

    async function load() {
      const [
        { data: room },
        { data: players },
        { data: pool },
        { data: transactions },
      ] = await Promise.all([
        db.getRoom(roomId),
        db.getPlayers(roomId),
        db.getPool(roomId),
        db.getTransactions(roomId),
      ])

      if (cancelled) return

      const myPlayer = players?.find(p => p.id === myPlayerId) ?? null
      dispatch({
        type: 'INIT',
        payload: {
          room,
          myPlayer,
          players: players ?? [],
          pool: pool ?? { score: 0 },
          transactions: transactions ?? [],
        },
      })
    }

    load()
    return () => { cancelled = true }
  }, [roomId, myPlayerId])

  // Realtime 订阅
  useEffect(() => {
    if (!roomId) return

    const channel = supabase.channel(`room-${roomId}`, { config: { presence: { key: myPlayerId } } })

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, ({ eventType, new: n, old: o }) => {
        if (eventType === 'DELETE') dispatch({ type: 'REMOVE_PLAYER', payload: o.id })
        else dispatch({ type: 'UPSERT_PLAYER', payload: n })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_pool', filter: `room_id=eq.${roomId}` }, ({ new: n }) => {
        dispatch({ type: 'SET_POOL', payload: n })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `room_id=eq.${roomId}` }, ({ new: n }) => {
        dispatch({ type: 'PREPEND_TX', payload: n })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `room_id=eq.${roomId}` }, ({ new: n }) => {
        dispatch({ type: 'UPDATE_TX', payload: n })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, ({ new: n }) => {
        dispatch({ type: 'SET_ROOM', payload: n })
        if (n.status === 'dissolved') onDissolved?.()
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [roomId, myPlayerId, onDissolved])

  // 在线心跳
  useEffect(() => {
    if (!myPlayerId) return
    db.setPlayerOnline(myPlayerId, true)
    const iv = setInterval(() => db.setPlayerOnline(myPlayerId, true), 25000)
    const goOffline = () => db.setPlayerOnline(myPlayerId, false)
    window.addEventListener('beforeunload', goOffline)
    return () => {
      clearInterval(iv)
      window.removeEventListener('beforeunload', goOffline)
      goOffline()
    }
  }, [myPlayerId])

  return (
    <RoomContext.Provider value={{ ...state, dispatch }}>
      {children}
    </RoomContext.Provider>
  )
}

export function useRoom() {
  return useContext(RoomContext)
}
