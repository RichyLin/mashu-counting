import { useState, useEffect } from 'react'
import { useRoom } from '../../context/RoomContext'
import * as db from '../../lib/db'

export default function TransferSheet({ open, targetPlayer, onClose, toast }) {
  const { room, myPlayer } = useRoom()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (open) setAmount('') }, [open])

  const amt = parseInt(amount) || 0

  async function handleConfirm() {
    if (!amt || amt <= 0) { toast('请输入有效分数'); return }
    setLoading(true)
    const desc = `${myPlayer.name} → ${targetPlayer.name}`
    const { error } = await db.transfer(room.id, myPlayer.id, targetPlayer.id, amt, desc)
    setLoading(false)
    if (error) { toast('转账失败：' + error.message); return }
    toast('转账成功')
    onClose()
  }

  return (
    <div className={`sheet-overlay${open ? ' open' : ''}`}>
      <div className="sheet-dim" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-knob" />
        <div className="sheet-ttl">转 账</div>

        {/* 收款方 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1.5px solid var(--brown)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, boxShadow: '0 2px 8px var(--shadow)' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--matcha-l)', border: '2px solid var(--brown)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            {targetPlayer?.emoji}
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 3 }}>付给对方</div>
            <div style={{ fontSize: 16, color: 'var(--brown)' }}>{targetPlayer?.name}</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 10 }}>
          {amt > 0 ? `你将付出 ${amt} 分给 ${targetPlayer?.name}` : `你将付出多少分？`}
        </div>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          style={{ width: '100%', background: '#fff', border: '2px solid var(--brown)', borderRadius: 14, padding: 14, fontSize: 44, color: 'var(--brown)', textAlign: 'center', fontFamily: "'Fredoka',sans-serif", fontWeight: 700, marginBottom: 20, boxShadow: '0 2px 8px var(--shadow)', outline: 'none' }}
        />
        <button className="btn-pink" onClick={handleConfirm} disabled={loading}>
          {loading ? '处理中…' : '确 认 转 账'}
        </button>
      </div>
    </div>
  )
}
