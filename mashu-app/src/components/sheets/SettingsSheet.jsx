import { useState } from 'react'
import { useRoom } from '../../context/RoomContext'
import { useConfirm, ConfirmDialog } from '../ConfirmDialog'
import * as db from '../../lib/db'

export default function SettingsSheet({ open, onClose, toast, onDissolved }) {
  const { room, players, myPlayer } = useRoom()
  const [initScore, setInitScore] = useState(room?.init_score ?? 200)
  const { confirmCfg, confirm, closeConfirm } = useConfirm()

  const others = players.filter(p => p.id !== myPlayer?.id)

  async function handleSaveInitScore() {
    const { error } = await db.updateInitScore(room.id, initScore)
    if (error) { toast('保存失败'); return }
    toast('初始分数已更新')
  }

  function handleKick(player) {
    confirm('踢出玩家', `确认将「${player.name}」踢出房间吗？`, async () => {
      const { error } = await db.kickPlayer(player.id)
      if (error) { toast('踢出失败'); return }
      toast(`已踢出 ${player.name}`)
    })
  }

  function handleReset() {
    confirm('重置房间', '所有玩家分数将重置为初始分数，交易记录清空。确认重置吗？', async () => {
      const { error } = await db.resetRoom(room.id, initScore)
      if (error) { toast('重置失败'); return }
      toast('房间已重置')
      onClose()
    })
  }

  function handleDissolve() {
    confirm('解散房间', '解散后所有数据将清除，所有玩家将退出房间。确认解散吗？', async () => {
      const { error } = await db.dissolveRoom(room.id)
      if (error) { toast('解散失败'); return }
      onDissolved?.()
    })
  }

  return (
    <>
      <div className={`sheet-overlay${open ? ' open' : ''}`}>
        <div className="sheet-dim" onClick={onClose} />
        <div className="sheet-panel" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <div className="sheet-knob" />
          <div className="sheet-ttl">房间设置</div>

          {/* 初始分数 */}
          <div style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 10 }}>初 始 分 数</div>
          <input
            type="number"
            inputMode="numeric"
            value={initScore}
            onChange={e => setInitScore(parseInt(e.target.value) || 0)}
            onBlur={handleSaveInitScore}
            style={{ width: '100%', background: '#fff', border: '2px solid var(--brown)', borderRadius: 14, padding: '14px 20px', fontSize: 24, color: 'var(--brown)', fontFamily: "'Fredoka',sans-serif", fontWeight: 700, marginBottom: 6, boxShadow: '0 2px 8px var(--shadow)', outline: 'none', textAlign: 'center' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 20 }}>修改后点击其他区域自动保存</div>

          {/* 踢人 */}
          <div style={{ height: 1, background: 'rgba(74,55,40,0.08)', margin: '4px 0 16px' }} />
          <div style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 12 }}>踢 出 玩 家</div>
          {others.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 20 }}>暂无其他玩家</div>
            : others.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1.5px solid var(--brown)', borderRadius: 12, padding: '10px 14px', marginBottom: 10, boxShadow: '0 2px 6px var(--shadow)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--matcha-l)', border: '1.5px solid var(--brown)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{p.emoji}</div>
                  <div style={{ flex: 1, fontSize: 15, color: 'var(--brown)' }}>{p.name}</div>
                  <button onClick={() => handleKick(p)} style={{ padding: '6px 14px', borderRadius: 10, fontSize: 12, border: '1.5px solid var(--red-minus)', color: 'var(--red-minus)', background: 'rgba(232,112,112,0.08)' }}>踢出</button>
                </div>
              ))
          }

          {/* 危险操作 */}
          <div style={{ height: 1, background: 'rgba(74,55,40,0.08)', margin: '8px 0 16px' }} />
          <button className="btn-danger" onClick={handleReset} style={{ marginBottom: 10 }}>重 置 分 数</button>
          <button className="btn-danger" onClick={handleDissolve}>解 散 房 间</button>
        </div>
      </div>

      {confirmCfg && (
        <div style={{ zIndex: 300, position: 'absolute', inset: 0 }}>
          <ConfirmDialog cfg={confirmCfg} onClose={closeConfirm} />
        </div>
      )}
    </>
  )
}
