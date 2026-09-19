import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Icon from '../components/ui/Icon'
import { uid } from '../lib/utils'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (message, tone = 'success') => {
      const id = uid('t')
      setToasts((t) => [...t, { id, message, tone }])
      setTimeout(() => dismiss(id), 3600)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-pop flex items-start gap-3 min-w-[280px] max-w-[380px] rounded-md bg-white border border-line shadow-pop px-4 py-3"
          >
            <span
              className={
                t.tone === 'error'
                  ? 'text-red-600 mt-0.5'
                  : t.tone === 'info'
                    ? 'text-brand-700 mt-0.5'
                    : 'text-emerald-600 mt-0.5'
              }
            >
              <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'info' ? 'info' : 'checkCircle'} />
            </span>
            <p className="text-[13.5px] text-ink-900 leading-5 flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-700">
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}
