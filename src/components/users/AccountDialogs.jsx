import { useEffect, useRef, useState } from 'react'
import { Button, Field, Icon, Modal } from '../ui'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { copyText, fullName, randomPassword } from '../../lib/utils'

/** Returns an error message, or null when the password can be saved as typed. */
export function passwordProblem(password, minLength = 8) {
  if (!password) return 'Type a password or click Generate.'
  if (password !== password.trim()) return 'Remove the spaces at the start or end of the password.'
  if (password.length < minLength) return `Use at least ${minLength} characters.`
  return null
}

export function usePasswordMinLength() {
  const { settings } = useData()
  return Math.max(4, Number(settings?.users?.passwordMinLength) || 8)
}

/**
 * The password box used wherever an administrator sets a password. It starts
 * empty — typing never mixes with a generated value — and is shown in plain
 * text so the admin can see exactly what the user will type. Phones are told
 * not to capitalise or autocorrect it.
 */
export function PasswordField({ label = 'Password', hint, value, onChange, error, required, className }) {
  const [visible, setVisible] = useState(true)
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      <div className="flex gap-3">
        <div className="relative flex-1 min-w-0">
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type a password"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!error}
            className="field pr-11 font-mono tracking-wide"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            <Icon name={visible ? 'eye' : 'lock'} className="w-[18px] h-[18px]" />
          </button>
        </div>
        <Button type="button" variant="ghost" icon="refresh" onClick={() => onChange(randomPassword())}>
          Generate
        </Button>
      </div>
    </Field>
  )
}

/** Shows an account's sign-in details exactly as saved, with a copy that really copies. */
export function CredentialsDialog({ open, user, password, onClose }) {
  const toast = useToast()
  const loginUrl = `${window.location.origin}/login`
  const details = user ? `Portal: ${loginUrl}\nEmail: ${user.email}\nPassword: ${password}` : ''

  async function copy() {
    const ok = await copyText(details)
    toast(ok ? 'Login details copied.' : 'Your browser blocked copying — select the details and copy them yourself.', ok ? 'success' : 'info')
  }

  return (
    <Modal
      open={open && !!user}
      onClose={onClose}
      title="Login details"
      subtitle="Send these to the user — only administrators can create accounts."
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" icon="copy" onClick={copy}>
            Copy
          </Button>
          <Button
            icon="mail"
            onClick={() => {
              window.location.href = `mailto:${user.email}?subject=${encodeURIComponent('Your GA Healthcare Training portal account')}&body=${encodeURIComponent(`Hello ${user.firstName},\n\nYour account is ready.\n\n${details}\n\nGA Healthcare Training & Consulting`)}`
              onClose()
            }}
          >
            Send by email
          </Button>
        </>
      }
    >
      {user && (
        <dl className="space-y-3.5 text-[14px]">
          <Row label="User" value={fullName(user)} />
          <Row label="Email" value={user.email} />
          <Row label="Sign in at" value={loginUrl} />
          <div className="flex justify-between items-center gap-4">
            <dt className="text-ink-500">Password</dt>
            <dd>
              <code className="bg-gray-100 rounded px-2.5 py-1 font-mono tracking-wide select-all">{password}</code>
            </dd>
          </div>
        </dl>
      )}
    </Modal>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-500 shrink-0">{label}</dt>
      <dd className="font-medium text-right break-all">{value}</dd>
    </div>
  )
}

/** Lets an administrator choose (or generate) a new password for an existing account. */
export function SetPasswordDialog({ open, user, onClose, onSave }) {
  const minLength = usePasswordMinLength()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setPassword('')
      setError('')
    }
    wasOpen.current = open
  }, [open])

  function save() {
    const problem = passwordProblem(password, minLength)
    if (problem) return setError(problem)
    onSave(password)
  }

  return (
    <Modal
      open={open && !!user}
      onClose={onClose}
      title="Set a new password"
      subtitle={user ? `${fullName(user)} · ${user.email}` : ''}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save password</Button>
        </>
      }
    >
      <PasswordField
        label="New password"
        hint={`At least ${minLength} characters. The old password stops working straight away.`}
        value={password}
        onChange={(v) => {
          setPassword(v)
          setError('')
        }}
        error={error}
        required
      />
    </Modal>
  )
}
