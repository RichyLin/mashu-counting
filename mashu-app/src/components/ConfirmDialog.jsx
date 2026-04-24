import { useState, useCallback } from 'react'

export function useConfirm() {
  const [cfg, setCfg] = useState(null) // { title, msg, onOk }

  const confirm = useCallback((title, msg, onOk) => {
    setCfg({ title, msg, onOk })
  }, [])

  const close = useCallback(() => setCfg(null), [])

  return { confirmCfg: cfg, confirm, closeConfirm: close }
}

export function ConfirmDialog({ cfg, onClose }) {
  if (!cfg) return null
  return (
    <div className="dialog-overlay">
      <div className="dialog-card">
        <h3>{cfg.title}</h3>
        <p>{cfg.msg}</p>
        <div className="dialog-btns">
          <button className="dialog-cancel" onClick={onClose}>取消</button>
          <button className="dialog-ok" onClick={() => { cfg.onOk(); onClose(); }}>确认</button>
        </div>
      </div>
    </div>
  )
}
