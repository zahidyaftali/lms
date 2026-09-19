import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/utils'
import Icon from './Icon'
import { Button } from './controls'

export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-2xl' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 sm:py-10 px-3 sm:px-4">
      <div className="fixed inset-0 bg-ink-900/40 animate-fade-in" onClick={onClose} />
      <div className={cx('relative w-full bg-white rounded-card shadow-pop animate-scale-in', width)}>
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-5 border-b border-line">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold text-ink-900">{title}</h3>
            {subtitle && <p className="hint mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 p-1 -mr-1 transition-colors shrink-0">
            <Icon name="x" />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 max-h-[65vh] overflow-y-auto scroll-thin">{children}</div>
        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-line flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', tone = 'danger' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[14px] text-ink-700 leading-6">{message}</p>
    </Modal>
  )
}

/**
 * Anchored menu used by the "Add user" split button, row actions and the
 * course builder's nested Add menu.
 */
export function Dropdown({ trigger, children, align = 'right', width = 'w-56', menuClassName }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={cx(
            'absolute z-40 mt-1.5 bg-white border border-line rounded-md shadow-pop py-1.5 animate-scale-in',
            align === 'right' ? 'right-0' : 'left-0',
            width,
            menuClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, danger, disabled, className }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] text-left transition',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-ink-900 hover:bg-gray-50',
        disabled && 'opacity-40 pointer-events-none',
        className,
      )}
    >
      {icon && <Icon name={icon} className="w-[18px] h-[18px] shrink-0 text-ink-700" />}
      <span className="flex-1">{children}</span>
    </button>
  )
}

export function MenuDivider() {
  return <div className="my-1.5 border-t border-line" />
}

/** Slide-over panel used for unit editors and detail views. */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-3xl' }) {
  useEffect(() => {
    if (!open) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/40 animate-fade-in" onClick={onClose} />
      <div className={cx('relative bg-white w-full h-full flex flex-col shadow-pop animate-slide-in-right', width)}>
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-5 border-b border-line">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold text-ink-900">{title}</h3>
            {subtitle && <p className="hint mt-1 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 p-1 -mr-1 transition-colors shrink-0">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin px-5 sm:px-6 py-5">{children}</div>
        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-line flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
