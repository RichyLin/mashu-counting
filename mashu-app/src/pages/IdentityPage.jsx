import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as db from '../lib/db'
import { getDeviceId, storePlayerId } from '../lib/deviceId'

const EMOJIS = ['🍡', '🐼', '🐨', '🦊', '🐸', '🐯', '🐻', '🐙', '🦄', '🐝', '🦋', '🍀', '🌸', '⭐', '🎃']
const BENCH_SEATS = ['bench-left', 'bench-right']
const NAME_RE = /^[\u4e00-\u9fa5a-zA-Z0-9]+$/

export default function IdentityPage({ room, onJoined }) {
  const { code } = useParams()
  const nav = useNavigate()
  const [emoji, setEmoji] = useState('🍡')
  const [name, setName] = useState('')
  const [nameErr, setNameErr] = useState('')
  const [loading, setLoading] = useState(false)
  // undefined = checking, null = full, string = available seat
  const [nextSeat, setNextSeat] = useState(undefined)

  useEffect(() => {
    db.getAvailableSeat(room.id).then(seat => setNextSeat(seat ?? null))
  }, [room.id])

  function handleName(e) {
    const val = e.target.value.slice(0, 6)
    setName(val)
    if (val && !NAME_RE.test(val.trim())) {
      setNameErr('仅支持汉字、字母、数字')
    } else {
      setNameErr('')
    }
  }

  const canSubmit = name.trim() && !nameErr && !loading

  async function handleEnter() {
    if (!canSubmit) return
    setLoading(true)
    try {
      const deviceId = getDeviceId()
      const seat = await db.getAvailableSeat(room.id)
      if (!seat) { alert('房间已满（最多6人）'); setLoading(false); return }

      const { data: player, error } = await db.createPlayer(
        room.id, deviceId, name.trim(), emoji, seat, room.init_score
      )
      if (error) throw error

      storePlayerId(code, player.id)
      if (onJoined) {
        onJoined(player.id)
      } else {
        nav(`/room/${code}`, { replace: true, state: { playerId: player.id } })
      }
    } catch (e) {
      alert('进入失败：' + e.message)
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ background: 'var(--mochi)', padding: '60px 28px 48px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 32% at 50% 8%, rgba(184,212,192,0.45) 0%, transparent 100%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24, cursor: 'pointer' }} onClick={() => nav('/')}>‹ 返回</div>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 28, color: 'var(--brown)', letterSpacing: '0.1em', marginBottom: 6 }}>设 置 身 份</div>
          <div style={{ fontSize: 13, color: 'var(--matcha)', letterSpacing: '0.12em' }}>房间 {code}</div>
        </div>

        {/* 头像预览 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 86, height: 86, borderRadius: '50%', background: 'var(--matcha-l)', border: '2px solid var(--brown)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, boxShadow: '0 4px 12px var(--shadow)' }}>
            {emoji}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>选 择 你 的 头 像</div>
        </div>

        {/* Emoji 选择器 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, background: '#fff', border: '1.5px solid var(--brown)', borderRadius: 16, padding: 12, marginBottom: 24, boxShadow: '0 4px 12px var(--shadow)' }}>
          {EMOJIS.map(e => (
            <div key={e} onClick={() => setEmoji(e)}
              style={{ width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, cursor: 'pointer', border: e === emoji ? '2px solid var(--matcha-d)' : '2px solid transparent', background: e === emoji ? 'rgba(122,171,138,0.18)' : 'transparent', transition: 'all 0.12s' }}>
              {e}
            </div>
          ))}
        </div>

        {/* 姓名 */}
        <div style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.14em', marginBottom: 10 }}>你 的 名 字</div>
        <input
          className={`text-input${nameErr ? ' error' : ''}`}
          type="text"
          placeholder="请输入姓名（最多6字）"
          value={name}
          onChange={handleName}
          onKeyDown={e => e.key === 'Enter' && handleEnter()}
          style={{ marginBottom: nameErr ? 6 : 28 }}
        />
        {nameErr && <div style={{ fontSize: 11, color: 'var(--red-minus)', marginBottom: 22 }}>{nameErr}</div>}

        {BENCH_SEATS.includes(nextSeat) && (
          <div style={{ background: 'rgba(122,171,138,0.15)', border: '1.5px solid var(--matcha)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: 'var(--matcha-d)', marginBottom: 16, letterSpacing: '0.05em', lineHeight: 1.6 }}>
            📋 当前桌位已满，你将以<strong>备战席</strong>身份加入，可转账和交公池，但不可收公池。
          </div>
        )}
        {nextSeat === null && (
          <div style={{ background: 'rgba(232,112,112,0.1)', border: '1.5px solid var(--red-minus)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: 'var(--red-minus)', marginBottom: 16 }}>
            房间已满（最多6人），无法加入。
          </div>
        )}

        <button className="btn-green" onClick={handleEnter} disabled={!canSubmit || nextSeat === null || nextSeat === undefined}>
          {loading ? '进入中…' : '进 入 房 间'}
        </button>
      </div>
    </div>
  )
}
