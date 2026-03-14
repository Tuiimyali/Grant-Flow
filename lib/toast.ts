/* ── Module-level toast store (no context needed) ─────────────── */

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id:      number
  message: string
  type:    ToastType
}

type Listener = (toasts: ToastItem[]) => void

let _toasts:    ToastItem[] = []
let _listeners: Listener[]  = []
let _nextId = 0

function _notify() {
  const copy = [..._toasts]
  _listeners.forEach(l => l(copy))
}

export function toast(message: string, type: ToastType = 'success', duration = 3500) {
  const id = _nextId++
  _toasts = [..._toasts, { id, message, type }]
  _notify()
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id)
    _notify()
  }, duration)
}

export function subscribeToasts(listener: Listener): () => void {
  _listeners = [..._listeners, listener]
  listener([..._toasts])
  return () => { _listeners = _listeners.filter(l => l !== listener) }
}
