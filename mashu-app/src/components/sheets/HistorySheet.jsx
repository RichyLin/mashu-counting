import { useRoom } from '../../context/RoomContext'
import * as db from '../../lib/db'
import { useConfirm, ConfirmDialog } from '../ConfirmDialog'

function getMyDelta(tx, myId) {
  if (tx.revoked) return null
  const isFrom = tx.from_player_id === myId
  const isTo   = tx.to_player_id   === myId
  switch (tx.type) {
    case 'transfer':     return isFrom ? -tx.amount : isTo ? +tx.amount : null
    case 'pool_pay':     return isFrom ? -tx.amount : null
    case 'pool_collect': return isFrom ? +tx.amount : null
    case 'revoke':       return isFrom ? +tx.amount : isTo ? -tx.amount : null
    default:             return null
  }
}

export default function HistorySheet({ open, onClose, toast }) {
  const { room, myPlayer, transactions } = useRoom()
  const { confirmCfg, confirm, closeConfirm } = useConfirm()

  async function handleRevoke(tx) {
    confirm('撤回确认', `确认撤回「${tx.description}」吗？该操作会还原对应分数变动。`, async () => {
      const { error } = await db.revokeTransaction(room.id, tx.id)
      if (error) { toast('撤回失败：' + error.message); return }
      toast('已撤回')
    })
  }

  return (
    <>
      <div className={`sheet-overlay${open ? ' open' : ''}`}>
        <div className="sheet-dim" onClick={onClose} />
        <div className="sheet-panel" style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div className="sheet-knob" />
          <div className="sheet-ttl">交易记录</div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {transactions.length === 0
              ? <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 14, padding: '40px 0' }}>暂无记录</div>
              : transactions.map(tx => {
                  const delta = getMyDelta(tx, myPlayer?.id)
                  const isRevoke = tx.type === 'revoke'
                  const isRevoked = tx.revoked
                  const dimmed = isRevoke || isRevoked
                  const color = delta == null ? 'var(--text-dim)'
                    : delta > 0 ? 'var(--green-plus)'
                    : delta < 0 ? 'var(--red-minus)'
                    : 'var(--gray-dis)'

                  return (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid rgba(74,55,40,0.08)', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 14, color: dimmed ? 'var(--gray-dis)' : 'var(--brown)' }}>
                        {tx.description}
                      </span>
                      {delta != null && (
                        <span style={{ fontSize: 16, fontFamily: "'Fredoka',sans-serif", fontWeight: 700, color, opacity: dimmed ? 0.5 : 1, minWidth: 38, textAlign: 'right' }}>
                          {delta > 0 ? '+' : ''}{delta}
                        </span>
                      )}
                      {!isRevoke && !isRevoked
                        ? <button onClick={() => handleRevoke(tx)} style={{ background: '#fff', border: '1.5px solid rgba(74,55,40,0.2)', borderRadius: 8, padding: '4px 10px', color: 'rgba(74,55,40,0.45)', fontSize: 12, whiteSpace: 'nowrap' }}>撤回</button>
                        : <span style={{ fontSize: 11, color: 'var(--gray-dis)', whiteSpace: 'nowrap', marginLeft: 8 }}>{isRevoked ? '已撤回' : ''}</span>
                      }
                    </div>
                  )
                })
            }
          </div>
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
