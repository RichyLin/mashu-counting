import { useState, useCallback, useRef } from 'react'

export function useToast() {
  const [msg, setMsg] = useState('')
  const [show, setShow] = useState(false)
  const timerRef = useRef(null)

  const toast = useCallback((text) => {
    setMsg(text)
    setShow(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShow(false), 1800)
  }, [])

  return { toastMsg: msg, toastShow: show, toast }
}

export function Toast({ msg, show }) {
  return <div className={`toast${show ? ' show' : ''}`}>{msg}</div>
}
