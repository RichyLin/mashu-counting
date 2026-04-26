import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoom, getViewPos } from '../context/RoomContext'
import { clearStoredPlayer } from '../lib/deviceId'
import { useToast, Toast } from '../components/Toast'
import { useConfirm, ConfirmDialog } from '../components/ConfirmDialog'
import * as db from '../lib/db'
import TransferSheet from '../components/sheets/TransferSheet'
import PoolSheet from '../components/sheets/PoolSheet'
import HistorySheet from '../components/sheets/HistorySheet'
import SettingsSheet from '../components/sheets/SettingsSheet'

const TABLE_SEATS = ['bottom', 'top', 'left', 'right']
const BENCH_SEATS = ['bench-left', 'bench-right']
const CW = ['bottom', 'right', 'top', 'left']

const POS_STYLE = {
  top:    { position: 'absolute', top: 14,   left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, zIndex: 5 },
  left:   { position: 'absolute', left: 8,   top: '50%',  transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, zIndex: 5 },
  right:  { position: 'absolute', right: 8,  top: '50%',  transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, zIndex: 5 },
  bottom: { position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, zIndex: 5 },
  'bench-left':  { position: 'absolute', top: 10, left: 10,  zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  'bench-right': { position: 'absolute', top: 10, right: 10, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
}

export default function TablePage() {
  const { room, myPlayer, players, pool, loading, error } = useRoom()
  const nav = useNavigate()
  const { toastMsg, toastShow, toast } = useToast()

  const [sheet, setSheet] = useState(null)
  const [transferTarget, setTransferTarget] = useState(null)
  const [benchFollowSeat, setBenchFollowSeat] = useState('bottom')
  const [swapMode, setSwapMode] = useState(false)
  const [swapFirst, setSwapFirst] = useState(null)   // player id
  const { confirmCfg: swapCfg, confirm: swapConfirm, closeConfirm: closeSwap } = useConfirm()

  const isHost  = room?.host_device_id === myPlayer?.device_id
  const isBench = BENCH_SEATS.includes(myPlayer?.seat)
  const effectiveSeat = isBench ? benchFollowSeat : (myPlayer?.seat ?? 'bottom')

  const tablePlayers = players.filter(p => TABLE_SEATS.includes(p.seat))
  const benchPlayers = players.filter(p => BENCH_SEATS.includes(p.seat))

  // 被踢出时跳回首页
  const confirmedInRoom = useRef(false)
  useEffect(() => {
    if (loading || !myPlayer) return
    const stillIn = players.some(p => p.id === myPlayer.id)
    if (stillIn) { confirmedInRoom.current = true; return }
    if (confirmedInRoom.current) { clearStoredPlayer(room?.code); nav('/') }
  }, [players, myPlayer, loading, room, nav])

  // ── View helpers ──────────────────────────────────────────
  function playerAt(viewPos) {
    return tablePlayers.find(p => {
      if (!isBench && p.id === myPlayer?.id) return false
      return getViewPos(p.seat, effectiveSeat) === viewPos
    }) ?? null
  }

  function bottomDisplayPlayer() {
    if (!isBench) return myPlayer
    return tablePlayers.find(p => p.seat === benchFollowSeat) ?? null
  }

  function isHostPlayer(player) {
    return player && room?.host_device_id === player.device_id
  }

  // 视图位置 → DB 座位（换座空位时需要知道目标 DB seat）
  function viewPosToDbSeat(viewPos) {
    return CW[(CW.indexOf(viewPos) + CW.indexOf(effectiveSeat)) % 4]
  }

  // ── Actions ───────────────────────────────────────────────
  function openTransfer(player) {
    if (!player || player.id === myPlayer?.id) return
    setTransferTarget(player)
    setSheet('transfer')
  }

  function toggleSwapMode() {
    setSwapMode(v => !v)
    setSwapFirst(null)
  }

  function handleSwapSelect(player) {
    if (!player) return
    if (!swapFirst) {
      setSwapFirst(player.id)
    } else if (swapFirst === player.id) {
      setSwapFirst(null)
    } else {
      const pFrom = players.find(p => p.id === swapFirst)
      const pTo = player
      setSwapFirst(null)
      swapConfirm(
        '换 座 确 认',
        `确认将「${pFrom?.name}」换到「${pTo.isEmpty ? '空位' : pTo?.name}」的座位吗？`,
        async () => {
          const result = pTo.isEmpty
            ? await db.moveSeat(pFrom.id, pTo.seat)
            : await db.swapSeats(pFrom.id, pTo.id)
          if (result?.error) { toast('换座失败：' + result.error.message); return }
          setSwapMode(false)
          toast('换座成功')
        }
      )
    }
  }

  function handleAvatarClick(player) {
    if (swapMode && isHost) handleSwapSelect(player)
    else openTransfer(player)
  }

  // ── Loading / error ───────────────────────────────────────
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
  const topP    = playerAt('top')
  const leftP   = playerAt('left')
  const rightP  = playerAt('right')
  const bottomP = bottomDisplayPlayer()

  // ── Render helpers ────────────────────────────────────────
  const swapSelected = id => swapMode && swapFirst && id === swapFirst

  function TableAvatar({ player, size = 62 }) {
    const sel = swapSelected(player?.id)
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: sel ? '3px solid var(--gold)' : '2px solid var(--brown)',
        outline: swapMode ? `2px dashed rgba(240,200,74,${sel ? 0.7 : 0.45})` : 'none',
        outlineOffset: 3,
        background: 'var(--mochi)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.45),
        boxShadow: sel
          ? '0 0 0 4px rgba(240,200,74,0.3), 0 4px 10px rgba(74,55,40,0.2)'
          : '0 4px 10px rgba(74,55,40,0.2)',
        position: 'relative', cursor: 'pointer', transition: 'all 0.15s',
      }}>
        {isHostPlayer(player) && (
          <span style={{ position: 'absolute', top: -19, left: '50%', transform: 'translateX(-50%)', fontSize: 15 }}>👑</span>
        )}
        {player?.emoji}
      </div>
    )
  }

  const NameTag = ({ children }) => (
    <div style={{ background: '#fff', border: '1.5px solid var(--brown)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--brown)', whiteSpace: 'nowrap', boxShadow: '0 2px 6px var(--shadow)' }}>
      {children}
    </div>
  )

  function renderTablePos(viewPos, player) {
    if (!player) {
      // 空位：swap 模式且已选第一个玩家时，显示可点击的目标
      if (swapMode && swapFirst) {
        const dbSeat = viewPosToDbSeat(viewPos)
        const emptySlot = { id: `empty-${dbSeat}`, seat: dbSeat, name: '空位', emoji: '', isEmpty: true }
        return (
          <div key={viewPos} style={POS_STYLE[viewPos]} onClick={() => handleSwapSelect(emptySlot)}>
            <div style={{ width: 62, height: 62, borderRadius: '50%', border: '2px dashed var(--gold)', background: 'rgba(240,200,74,0.08)', cursor: 'pointer', transition: 'all 0.15s' }} />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>空 位</div>
          </div>
        )
      }
      return (
        <div key={viewPos} style={POS_STYLE[viewPos]}>
          <div style={{ width: 62, height: 62, borderRadius: '50%', border: '2px dashed rgba(74,55,40,0.18)', background: 'transparent' }} />
        </div>
      )
    }
    return (
      <div key={viewPos} style={POS_STYLE[viewPos]} onClick={() => handleAvatarClick(player)}>
        <TableAvatar player={player} size={62} />
        <NameTag>{player.name}</NameTag>
      </div>
    )
  }

  function renderBench(dbSeat) {
    const player = benchPlayers.find(p => p.seat === dbSeat)
    const isMe   = player?.id === myPlayer?.id
    const sel    = swapSelected(player?.id)
    return (
      <div key={dbSeat} style={POS_STYLE[dbSeat]}>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.1em', background: 'rgba(74,55,40,0.08)', borderRadius: 6, padding: '2px 6px', marginBottom: 1 }}>备战席</div>
        {player ? (
          <>
            <div
              onClick={() => isMe
                ? (swapMode && isHost && handleSwapSelect(player))
                : handleAvatarClick(player)
              }
              style={{
                width: 46, height: 46, borderRadius: '50%',
                border: sel ? '3px solid var(--gold)' : isMe ? '2.5px solid var(--gold)' : '2px dashed var(--matcha-d)',
                outline: swapMode ? `2px dashed rgba(240,200,74,${sel ? 0.7 : 0.4})` : 'none',
                outlineOffset: 3,
                background: isMe ? 'var(--mochi)' : 'rgba(134,179,122,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                position: 'relative', cursor: (isMe && !swapMode) ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {isHostPlayer(player) && (
                <span style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 12 }}>👑</span>
              )}
              {player.emoji}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
              {isMe ? player.name + '（我）' : player.name}
            </div>
            {isMe && (
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--brown)', fontFamily: "'Fredoka',sans-serif" }}>
                {player.score}
              </div>
            )}
          </>
        ) : (
          <div style={{ width: 46, height: 46, borderRadius: '50%', border: '2px dashed rgba(74,55,40,0.15)', background: 'transparent' }} />
        )}
      </div>
    )
  }

  const bottomSel  = swapSelected(bottomP?.id)
  const bottomIsHost = isHostPlayer(bottomP)

  return (
    <div className="app-shell">
      {/* 顶部导航 */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 0', background: 'rgba(245,240,232,0.95)', borderBottom: '1.5px solid rgba(74,55,40,0.1)', backdropFilter: 'blur(6px)', zIndex: 10, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>房间</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--matcha-d)', fontFamily: "'Fredoka',sans-serif", letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{room?.code}</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.08em', flexShrink: 0 }}>{onlineCount}人在线</span>
        {isHost && (
          <button
            onClick={toggleSwapMode}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 13, letterSpacing: '0.06em', border: '1.5px solid var(--brown)', background: swapMode ? 'var(--brown)' : 'var(--gold)', color: swapMode ? 'var(--gold)' : 'var(--brown)', cursor: 'pointer' }}
          >
            {swapMode ? '取消换座' : '换 座'}
          </button>
        )}
      </div>

      {/* 换座模式提示条 */}
      {swapMode && (
        <div style={{ background: 'rgba(240,200,74,0.92)', padding: '9px 20px', fontSize: 13, color: 'var(--brown)', textAlign: 'center', letterSpacing: '0.05em', flexShrink: 0, zIndex: 9 }}>
          {swapFirst
            ? `已选中「${players.find(p => p.id === swapFirst)?.name}」，再点另一位确认换座`
            : '点击任意玩家选择换座'}
        </div>
      )}

      {/* 麻将桌区域 */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 75% at 50% 50%, rgba(122,171,138,0.35) 0%, #D8EAD8 100%)', pointerEvents: 'none' }} />

        {/* 椭圆桌面 */}
        <div style={{ position: 'absolute', width: 292, height: 452, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(ellipse 80% 70% at 38% 35%, #8ABE96 0%, #6EA07A 55%, #5A8A6A 100%)', border: '2.5px solid var(--brown)', boxShadow: '0 0 0 4px rgba(122,171,138,0.25), 0 16px 48px rgba(74,55,40,0.2), inset 0 0 60px rgba(74,55,40,0.1)' }}>
          <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
        </div>

        {/* 备战席 */}
        {renderBench('bench-left')}
        {renderBench('bench-right')}

        {/* 上 / 左 / 右 */}
        {renderTablePos('top',   topP)}
        {renderTablePos('left',  leftP)}
        {renderTablePos('right', rightP)}

        {/* 公池 */}
        <div onClick={() => setSheet('pool')} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-52%)', zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <img src="/ip-reclining.jpg" alt="公池" style={{ width: 128, height: 76, objectFit: 'contain', objectPosition: 'bottom center', display: 'block', position: 'relative', zIndex: 2, marginBottom: -12, filter: 'drop-shadow(0 4px 6px rgba(74,55,40,0.2))' }} />
          <div style={{ background: 'linear-gradient(160deg, var(--gold) 0%, var(--gold-d) 100%)', border: '2px solid var(--brown)', borderRadius: 20, padding: '7px 20px', display: 'flex', alignItems: 'baseline', gap: 4, boxShadow: '0 4px 12px rgba(74,55,40,0.2), 0 2px 0 rgba(74,55,40,0.3)', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 13, color: 'var(--brown)', letterSpacing: '0.06em' }}>公池</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--brown)', fontFamily: "'Fredoka',sans-serif" }}>{pool.score}</span>
            <span style={{ fontSize: 13, color: 'var(--brown)' }}>分</span>
          </div>
        </div>

        {/* 下方：自己 或 备战席跟随的桌上玩家 */}
        <div
          style={{ ...POS_STYLE.bottom, bottom: isBench ? 66 : 2 }}
          onClick={() => {
            if (swapMode && isHost) handleSwapSelect(bottomP)
            else if (isBench) openTransfer(bottomP)
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            border: bottomSel ? '3px solid var(--gold)' : isBench ? '2px solid var(--brown)' : '2.5px solid var(--gold)',
            outline: swapMode ? `2px dashed rgba(240,200,74,${bottomSel ? 0.7 : 0.45})` : 'none',
            outlineOffset: 3,
            background: 'var(--mochi)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
            boxShadow: bottomSel
              ? '0 0 0 4px rgba(240,200,74,0.3), 0 4px 12px rgba(74,55,40,0.2)'
              : '0 0 0 3px rgba(240,200,74,0.3), 0 4px 12px rgba(74,55,40,0.2)',
            position: 'relative',
            cursor: (swapMode && isHost) || isBench ? 'pointer' : 'default',
          }}>
            {bottomIsHost && (
              <span style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 16 }}>👑</span>
            )}
            {bottomP?.emoji}
          </div>
          <NameTag>{isBench ? bottomP?.name : `${myPlayer?.name}（我）`}</NameTag>
          {!isBench && (
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brown)', fontFamily: "'Fredoka',sans-serif" }}>
              {myPlayer?.score ?? 0}
            </div>
          )}
        </div>

        {/* 备战席跟随选择条（仅备战席玩家可见） */}
        {isBench && (
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 12, background: 'rgba(74,55,40,0.78)', borderRadius: 16, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em' }}>观看：</span>
            {tablePlayers.map(p => (
              <div
                key={p.id}
                onClick={() => setBenchFollowSeat(p.seat)}
                style={{ width: 34, height: 34, borderRadius: '50%', border: p.seat === benchFollowSeat ? '2px solid var(--gold)' : '2px solid rgba(255,255,255,0.3)', background: p.seat === benchFollowSeat ? 'rgba(240,200,74,0.2)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {p.emoji}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部导航 */}
      <div style={{ height: 68, flexShrink: 0, background: 'rgba(245,240,232,0.95)', borderTop: '1.5px solid rgba(74,55,40,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 60px 10px' }}>
        <div onClick={() => setSheet('history')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>记录</span>
        </div>
        <div onClick={() => setSheet('settings')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>设置</span>
        </div>
      </div>

      {/* ── Sheets ── */}
      <TransferSheet open={sheet === 'transfer'} targetPlayer={transferTarget} onClose={() => setSheet(null)} toast={toast} />
      <PoolSheet     open={sheet === 'pool'}     onClose={() => setSheet(null)} toast={toast} />
      <HistorySheet  open={sheet === 'history'}  onClose={() => setSheet(null)} toast={toast} />
      <SettingsSheet open={sheet === 'settings'} onClose={() => setSheet(null)} toast={toast} onDissolved={() => nav('/')} />

      {swapCfg && (
        <div style={{ zIndex: 300, position: 'absolute', inset: 0 }}>
          <ConfirmDialog cfg={swapCfg} onClose={closeSwap} />
        </div>
      )}

      <Toast msg={toastMsg} show={toastShow} />
    </div>
  )
}
