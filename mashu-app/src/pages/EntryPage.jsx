import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as db from '../lib/db'

export default function EntryPage() {
  const [mode, setMode] = useState(null) // null | 'create' | 'join'
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  function openMode(m) {
    setMode(m)
    setCode('')
    setErr('')
  }

  function handleBack() {
    setMode(null)
    setCode('')
    setErr('')
  }

  function handleInput(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setCode(val)
    setErr('')
  }

  async function handleConfirm() {
    if (code.length !== 4) { setErr('请输入4位数字房间号'); return }
    setLoading(true)
    try {
      const existing = await db.getActiveRoom(code)
      if (mode === 'create') {
        if (existing) {
          setErr('该房间号已存在，请加入或换一个号码')
          setLoading(false)
          return
        }
      } else {
        if (!existing) {
          setErr('该房间号不存在，请检查号码或创建新房间')
          setLoading(false)
          return
        }
      }
      nav(`/room/${code}`)
    } catch {
      setErr('网络错误，请重试')
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ background: 'var(--mochi)', alignItems: 'center', justifyContent: 'center', padding: '60px 32px 52px', overflow: 'hidden' }}>
      {/* 背景光晕 */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 55% at 50% 35%, rgba(184,212,192,0.55) 0%, transparent 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 240, height: 240, top: -80, right: -70, borderRadius: '50%', border: '1.5px dashed rgba(122,171,138,0.2)' }} />
      <div style={{ position: 'absolute', width: 160, height: 160, bottom: 120, left: -55, borderRadius: '50%', border: '1.5px dashed rgba(122,171,138,0.2)' }} />

      {/* Logo */}
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: mode ? 32 : 52 }}>
        <div style={{ width: 120, height: 130, margin: '0 auto 16px' }}>
          <img src="/ip-standing.jpg" alt="麻薯" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontSize: 34, color: 'var(--matcha-d)', letterSpacing: '0.22em', textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}>麻薯计分</div>
      </div>

      <div style={{ width: '100%', position: 'relative' }}>
        {!mode ? (
          /* 初始状态：两个主按钮 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button className="btn-green" onClick={() => openMode('create')}>
              创 建 房 间
            </button>
            <button
              onClick={() => openMode('join')}
              style={{ width: '100%', padding: 18, borderRadius: 16, fontSize: 18, letterSpacing: '0.1em', border: '2px solid var(--brown)', cursor: 'pointer', background: '#fff', color: 'var(--brown)', boxShadow: '0 2px 0 var(--brown)', fontFamily: 'inherit' }}
            >
              加 入 房 间
            </button>
          </div>
        ) : (
          /* 输入状态 */
          <>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.2em', textAlign: 'center', marginBottom: 12 }}>
              {mode === 'create' ? '设 定 房 间 号' : '输 入 房 间 号'}
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={handleInput}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="8888"
              autoFocus
              style={{
                width: '100%', background: '#fff',
                border: `2px solid ${err ? 'var(--red-minus)' : 'var(--brown)'}`,
                borderRadius: 16, padding: 18,
                fontSize: 38, color: 'var(--brown)', textAlign: 'center',
                letterSpacing: '0.5em', fontFamily: "'Fredoka', sans-serif", fontWeight: 700,
                marginBottom: 14, boxShadow: '0 4px 12px var(--shadow)', outline: 'none',
              }}
            />
            {err && <div style={{ fontSize: 12, color: 'var(--red-minus)', textAlign: 'center', marginBottom: 10, marginTop: -8 }}>{err}</div>}
            <button className="btn-green" onClick={handleConfirm} disabled={loading}>
              {loading ? '确认中…' : (mode === 'create' ? '创 建 房 间' : '加 入 房 间')}
            </button>
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-light)', textAlign: 'center', cursor: 'pointer' }} onClick={handleBack}>
              ‹ 返 回
            </div>
          </>
        )}
      </div>
    </div>
  )
}
