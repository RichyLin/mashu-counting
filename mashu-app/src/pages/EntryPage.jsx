import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function EntryPage() {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const nav = useNavigate()

  function handleInput(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setCode(val)
    setErr('')
  }

  function handleEnter() {
    if (code.length !== 4) { setErr('请输入4位数字房间号'); return }
    nav(`/room/${code}`)
  }

  return (
    <div className="page" style={{ background: 'var(--mochi)', alignItems: 'center', justifyContent: 'center', padding: '60px 32px 52px', overflow: 'hidden' }}>
      {/* 背景光晕 */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 55% at 50% 35%, rgba(184,212,192,0.55) 0%, transparent 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 240, height: 240, top: -80, right: -70, borderRadius: '50%', border: '1.5px dashed rgba(122,171,138,0.2)' }} />
      <div style={{ position: 'absolute', width: 160, height: 160, bottom: 120, left: -55, borderRadius: '50%', border: '1.5px dashed rgba(122,171,138,0.2)' }} />

      {/* Logo */}
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 8 }}>
        <div style={{ width: 120, height: 130, margin: '0 auto 16px' }}>
          <img src="/ip-standing.jpg" alt="麻薯" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontSize: 34, color: 'var(--matcha-d)', letterSpacing: '0.22em', marginBottom: 4, textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}>麻薯计分</div>
        <div style={{ marginBottom: 52 }} />
      </div>

      {/* 输入区 */}
      <div style={{ width: '100%', position: 'relative' }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.2em', textAlign: 'center', marginBottom: 12 }}>输 入 房 间 号</div>
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={handleInput}
          onKeyDown={e => e.key === 'Enter' && handleEnter()}
          placeholder="8888"
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
        <button className="btn-green" onClick={handleEnter}>进 入 房 间</button>
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-light)', textAlign: 'center' }}>房间不存在将自动创建</div>
      </div>
    </div>
  )
}
