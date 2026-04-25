import { useRoom } from '../../context/RoomContext'
import * as db from '../../lib/db'

export default function PoolSheet({ open, onClose, toast }) {
  const { room, myPlayer, pool } = useRoom()

  async function handlePay() {
    const { error } = await db.payPool(room.id, myPlayer.id, `${myPlayer.name} 交公池`)
    if (error) { toast('操作失败'); return }
    toast('已交1分到公池')
    onClose()
  }

  async function handleCollect() {
    if (pool.score <= 0) return
    const { error } = await db.collectPool(room.id, myPlayer.id, `${myPlayer.name} 收公池`)
    if (error) { toast('操作失败'); return }
    toast(`收到公池 ${pool.score} 分`)
    onClose()
  }

  const isBench   = ['bench-left', 'bench-right'].includes(myPlayer?.seat)
  const canCollect = !isBench && pool.score > 0

  return (
    <div className={`sheet-overlay${open ? ' open' : ''}`}>
      <div className="sheet-dim" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-knob" />
        <div className="sheet-ttl">公 池</div>

        {/* 公池分数 */}
        <div style={{ textAlign: 'center', background: 'linear-gradient(160deg, var(--gold) 0%, var(--gold-d) 100%)', border: '2px solid var(--brown)', borderRadius: 16, padding: 18, marginBottom: 22, boxShadow: '0 4px 12px var(--shadow)' }}>
          <div style={{ fontSize: 12, color: 'var(--brown)', opacity: 0.7, letterSpacing: '0.12em', marginBottom: 4 }}>当前公池</div>
          <div style={{ fontSize: 52, fontWeight: 700, color: 'var(--brown)', fontFamily: "'Fredoka',sans-serif", lineHeight: 1 }}>{pool.score}</div>
          <div style={{ fontSize: 14, color: 'var(--brown)', opacity: 0.7, marginTop: 2 }}>分</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={handlePay}
            style={{ width: '100%', padding: 18, borderRadius: 16, fontSize: 18, letterSpacing: '0.1em', border: '2px solid var(--brown)', cursor: 'pointer', background: 'var(--matcha-l)', color: 'var(--brown)', boxShadow: '0 2px 0 var(--brown)' }}>
            交公池（-1分）
          </button>
          <button onClick={handleCollect} disabled={!canCollect}
            style={{ width: '100%', padding: 18, borderRadius: 16, fontSize: 18, letterSpacing: '0.1em', cursor: canCollect ? 'pointer' : 'not-allowed', border: canCollect ? '2px solid var(--brown)' : '2px solid var(--gray-dis)', background: canCollect ? 'linear-gradient(160deg, var(--gold) 0%, var(--gold-d) 100%)' : 'var(--gray-dis)', color: canCollect ? 'var(--brown)' : 'rgba(74,55,40,0.35)', boxShadow: canCollect ? '0 2px 0 var(--brown)' : 'none' }}>
            {isBench ? '备战席不可收公池' : `收公池（+${pool.score}分）`}
          </button>
        </div>
      </div>
    </div>
  )
}
