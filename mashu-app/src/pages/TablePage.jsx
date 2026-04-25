import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRoom, getViewPos } from '../context/RoomContext'
import { useToast, Toast } from '../components/Toast'
import TransferSheet from '../components/sheets/TransferSheet'
import PoolSheet from '../components/sheets/PoolSheet'
import HistorySheet from '../components/sheets/HistorySheet'
import SettingsSheet from '../components/sheets/SettingsSheet'

// ── 座位样式 ─────────────────────────────────────────────────
const POS_STYLE = {
  top:    { position: 'absolute', top: 14,   left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, zIndex: 5 },
  left:   { position: 'absolute', left: 8,   top:  '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, zIndex: 5 },
  right:  { position: 'absolute', right: 8,  top:  '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, zIndex: 5 },
  bottom: { position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, zIndex: 5 },
}

// ── 换座拖拽 ─────────────────────────────────────────────────
function useDragSwap({ players, myPlayer, getViewPos: gvp, onSwapRequest }) {
  const touchRef = useRef(null)
  const ghostRef = useRef(null)
  const dragFromRef = useRef(null)
  const dragOverRef = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const spawnGhost = useCallback((emoji, cx, cy, appEl) => {
    const g = document.createElement('div')
    g.style.cssText = `position:absolute;width:56px;height:56px;border-radius:50%;background:var(--matcha-l);border:2px solid var(--matcha-d);display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 8px 24px rgba(74,55,40,0.3);pointer-events:none;z-index:9998;opacity:0.85;transform:translate(-50%,-50%) scale(1.1);transition:opacity 0.1s;`
    g.textContent = emoji
    appEl.appendChild(g)
    const r = appEl.getBoundingClientRect()
    g.style.left = (cx - r.left) + 'px'
    g.style.top  = (cy - r.top)  + 'px'
    ghostRef.current = g
  }, [])

  const moveGhost = useCallback((cx, cy, appEl) => {
    if (!ghostRef.current) return
    const r = appEl.getBoundingClientRect()
    ghostRef.current.style.left = (cx - r.left) + 'px'
    ghostRef.current.style.top  = (cy - r.top)  + 'px'
  }, [])

  const cleanup = useCallback(() => {
    ghostRef.current?.remove(); ghostRef.current = null
    setDragOver(null); dragOverRef.current = null
    document.querySelectorAll('[data-seat]').forEach(el => el.style.opacity = '')
  }, [])

  const detectOver = useCallback((cx, cy) => {
    let over = null
    document.querySelectorAll('[data-seat]').forEach(el => {
      const r = el.getBoundingClientRect()
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        const s = el.dataset.seat
        if (s !== dragFromRef.current) over = s
      }
    })
    dragOverRef.current = over
    setDragOver(over)
  }, [])

  function bindAvatar(viewPos, player) {
    if (!player) return {}
    return {
      onTouchStart(e) {
        e.preventDefault()
        const t = e.touches[0]
        const appEl = e.currentTarget.closest('.app-shell')
        const avatarEl = e.currentTarget

        touchRef.current = {
          seat: viewPos, startX: t.clientX, startY: t.clientY, dragging: false,
          timer: setTimeout(() => {
            if (!touchRef.current || touchRef.current.seat !== viewPos) return
            touchRef.current.dragging = true
            dragFromRef.current = viewPos
            spawnGhost(player.emoji, t.clientX, t.clientY, appEl)
            avatarEl.style.opacity = '0.35'
          }, 300),
        }
      },
      onTouchMove(e) {
        if (!touchRef.current) return
        const t = e.touches[0]
        if (touchRef.current.dragging) {
          e.preventDefault()
          moveGhost(t.clientX, t.clientY, e.currentTarget.closest('.app-shell'))
          detectOver(t.clientX, t.clientY)
        } else {
          const dx = t.clientX - touchRef.current.startX
          const dy = t.clientY - touchRef.current.startY
          if (Math.sqrt(dx*dx + dy*dy) > 8) {
            clearTimeout(touchRef.current.timer); touchRef.current = null
          }
        }
      },
      onTouchEnd(e) {
        if (!touchRef.current || touchRef.current.seat !== viewPos) return
        clearTimeout(touchRef.current.timer)
        const wasDragging = touchRef.current.dragging
        touchRef.current = null
        if (wasDragging) {
          const target = dragOverRef.current
          const from   = dragFromRef.current
          cleanup()
          if (from && target && target !== from) onSwapRequest(from, target)
        }
        // tap → handled by onClick
      },
    }
  }

  return { bindAvatar, dragOver, cleanup }
}

// ── TablePage ────────────────────────────────────────────────
export default function TablePage() {
  const { room, myPlayer, players, pool, loading, error } = useRoom()
  const nav = useNavigate()
  const { toastMsg, toastShow, toast } = useToast()

  const [sheet, setSheet] = useState(null)   // 'transfer' | 'pool' | 'history' | 'settings'
  const [transferTarget, setTransferTarget] = useState(null)
  const [swapReq, setSwapReq] = useState(null) // { from, to }

  const isHost = room?.host_device_id === myPlayer?.device_id

  // 视图旋转：其他玩家的 DB seat → 相对于我的显示位置
  const mySeat = myPlayer?.seat ?? 'bottom'
  function playerAt(viewPos) {
    return players.find(p => p.id !== myPlayer?.id && getViewPos(p.seat, mySeat) === viewPos) ?? null
  }

  const topPlayer   = playerAt('top')
  const leftPlayer  = playerAt('left')
  const rightPlayer = playerAt('right')

  function openTransfer(player) {
    setTransferTarget(player)
    setSheet('transfer')
  }

  // 换座确认
  function handleSwapRequest(fromView, toView) {
    setSwapReq({ from: fromView, to: toView })
  }

  async function confirmSwap() {
    if (!swapReq) return
    const { from, to } = swapReq

    function playerAtView(v) {
      if (v === 'bottom') return myPlayer
      return playerAt(v)
    }
    const pFrom = playerAtView(from)
    const pTo   = playerAtView(to)
    if (!pFrom) { setSwapReq(null); return }

    if (pTo) {
      // 两个座位都有人 → 互换 DB seat
      await Promise.all([
        supabase.from('players').update({ seat: pTo.seat }).eq('id', pFrom.id),
        supabase.from('players').update({ seat: pFrom.seat }).eq('id', pTo.id),
      ])
    } else {
      // 目标座位为空 → 只移动 pFrom 到目标 DB seat
      const CW = ['bottom', 'right', 'top', 'left']
      const targetDbSeat = CW[(CW.indexOf(to) + CW.indexOf(mySeat)) % 4]
      await supabase.from('players').update({ seat: targetDbSeat }).eq('id', pFrom.id)
    }
    setSwapReq(null)
    toast('换座成功')
  }

  const { bindAvatar, dragOver } = useDragSwap({
    players, myPlayer,
    getViewPos, // just passing through for reference
    onSwapRequest: handleSwapRequest,
  })

  if (loading) return (
    <div className="app-shell">
      <div className="spin-wrap"><div className="spinner" /></div>
    </div>
  )

  if (error) return (
    <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>{error}</div>
      <button className="btn-green" style={{ width: 'auto', padding: '12px 32px' }} onClick={() => nav('/')}>返回首页</button>
    </div>
  )

  const onlineCount = players.filter(p => p.is_online).length

  // ─── avatar 渲染 helper
  function renderOtherAvatar(viewPos, player) {
    if (!player) return null
    const isOver = dragOver === viewPos
    return (
      <div style={POS_STYLE[viewPos]} data-seat={viewPos}>
        <div
          data-seat={viewPos}
          onClick={() => openTransfer(player)}
          {...bindAvatar(viewPos, player)}
          onContextMenu={e => e.preventDefault()}
          style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${isOver ? 'var(--gold)' : 'var(--brown)'}`, background: 'var(--mochi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, boxShadow: isOver ? '0 0 0 3px rgba(240,200,74,0.4), 0 4px 10px rgba(74,55,40,0.2)' : '0 4px 10px rgba(74,55,40,0.2)', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', transition: 'transform 0.15s', touchAction: 'none' }}
        >
          {player.emoji}
        </div>
        <div style={{ background: '#fff', border: '1.5px solid var(--brown)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--brown)', whiteSpace: 'nowrap', boxShadow: '0 2px 6px var(--shadow)' }}>
          {player.name}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* 顶部导航 */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 0', background: 'rgba(245,240,232,0.95)', borderBottom: '1.5px solid rgba(74,55,40,0.1)', backdropFilter: 'blur(6px)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>房间</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--matcha-d)', fontFamily: "'Fredoka',sans-serif", letterSpacing: '0.1em', flexShrink: 0, whiteSpace: 'nowrap' }}>{room?.code}</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>{onlineCount}人在线</span>
      </div>

      {/* 麻将桌区域 */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 75% at 50% 50%, rgba(122,171,138,0.35) 0%, #D8EAD8 100%)', pointerEvents: 'none' }} />

        {/* 椭圆桌面 */}
        <div style={{ position: 'absolute', width: 292, height: 452, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(ellipse 80% 70% at 38% 35%, #8ABE96 0%, #6EA07A 55%, #5A8A6A 100%)', border: '2.5px solid var(--brown)', boxShadow: '0 0 0 4px rgba(122,171,138,0.25), 0 16px 48px rgba(74,55,40,0.2), inset 0 0 60px rgba(74,55,40,0.1)' }}>
          <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
        </div>

        {/* 上方玩家 */}
        {renderOtherAvatar('top', topPlayer)}
        {/* 左方玩家 */}
        {renderOtherAvatar('left', leftPlayer)}
        {/* 右方玩家 */}
        {renderOtherAvatar('right', rightPlayer)}

        {/* 公池 */}
        <div onClick={() => setSheet('pool')} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-52%)', zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <img src="/ip-reclining.jpg" alt="公池" style={{ width: 148, height: 88, objectFit: 'contain', objectPosition: 'bottom center', display: 'block', position: 'relative', zIndex: 2, marginBottom: -12, filter: 'drop-shadow(0 4px 6px rgba(74,55,40,0.2))' }} />
          <div style={{ background: 'linear-gradient(160deg, var(--gold) 0%, var(--gold-d) 100%)', border: '2px solid var(--brown)', borderRadius: 20, padding: '7px 20px', display: 'flex', alignItems: 'baseline', gap: 4, boxShadow: '0 4px 12px rgba(74,55,40,0.2), 0 2px 0 rgba(74,55,40,0.3)', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 13, color: 'var(--brown)', letterSpacing: '0.06em' }}>公池</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--brown)', fontFamily: "'Fredoka',sans-serif" }}>{pool.score}</span>
            <span style={{ fontSize: 13, color: 'var(--brown)' }}>分</span>
          </div>
        </div>

        {/* 自己（下方） */}
        <div style={POS_STYLE.bottom} data-seat="bottom">
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: '2.5px solid var(--gold)', background: 'var(--mochi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: '0 0 0 3px rgba(240,200,74,0.3), 0 4px 12px rgba(74,55,40,0.2)', position: 'relative' }}>
            <span style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 16 }}>
              {isHost ? '👑' : ''}
            </span>
            {myPlayer?.emoji}
          </div>
          <div style={{ background: '#fff', border: '1.5px solid var(--brown)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--brown)', whiteSpace: 'nowrap', boxShadow: '0 2px 6px var(--shadow)' }}>
            {myPlayer?.name}（我）
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brown)', fontFamily: "'Fredoka',sans-serif" }}>
            {myPlayer?.score ?? 0}
          </div>
        </div>
      </div>

      {/* 底部导航 */}
      <div style={{ height: 68, flexShrink: 0, background: 'rgba(245,240,232,0.95)', borderTop: '1.5px solid rgba(74,55,40,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 60px 10px' }}>
        <div onClick={() => setSheet('history')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>记录</span>
        </div>
        {isHost && (
          <div onClick={() => setSheet('settings')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
            <span style={{ fontSize: 22 }}>⚙️</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>设置</span>
          </div>
        )}
      </div>

      {/* ── Sheets ── */}
      <TransferSheet open={sheet === 'transfer'} targetPlayer={transferTarget} onClose={() => setSheet(null)} toast={toast} />
      <PoolSheet     open={sheet === 'pool'}     onClose={() => setSheet(null)} toast={toast} />
      <HistorySheet  open={sheet === 'history'}  onClose={() => setSheet(null)} toast={toast} />
      {isHost && <SettingsSheet open={sheet === 'settings'} onClose={() => setSheet(null)} toast={toast} onDissolved={() => nav('/')} />}

      {/* ── 换座确认 ── */}
      {swapReq && (
        <div className="dialog-overlay" style={{ zIndex: 200 }}>
          <div className="dialog-card">
            <h3>换 座 确 认</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '16px 0 20px' }}>
              {[swapReq.from, swapReq.to].map((v, i) => {
                const p = v === 'bottom' ? myPlayer : playerAt(v)
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--matcha-l)', border: '2px solid var(--brown)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{p?.emoji}</div>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{p?.name}</span>
                    {i === 0 && <span style={{ fontSize: 16, color: 'var(--text-dim)' }}>⇄</span>}
                  </div>
                )
              })}
            </div>
            <div className="dialog-btns">
              <button className="dialog-cancel" onClick={() => setSwapReq(null)}>取消</button>
              <button style={{ flex: 1, padding: 14, background: 'linear-gradient(160deg, var(--matcha) 0%, var(--matcha-d) 100%)', border: '2px solid var(--brown)', borderRadius: 14, fontSize: 15, color: '#fff' }} onClick={confirmSwap}>确认换座</button>
            </div>
          </div>
        </div>
      )}

      <Toast msg={toastMsg} show={toastShow} />
    </div>
  )
}
