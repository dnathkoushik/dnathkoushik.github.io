import { useState } from 'react'
import type { FormEvent } from 'react'
import { isCryptoAvailable, PBKDF2_ITERATIONS } from '@/services/crypto'
import type { Tone } from '@/types'
import { todayISO } from '@/utils/date'
import { numberFormat } from '@/utils/format'
import { usePersonalData } from '@/providers/personalDataContext'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Progress } from '@/components/ui/Progress'
import { useToast } from '@/components/ui/Toast'

const MIN_LENGTH = 8

interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  tone: Tone
  hint: string
}

/**
 * A deliberately blunt strength estimate.
 *
 * It counts length and character variety and nothing else — no dictionary, no
 * false precision. The honest advice for a key with no recovery path is "make
 * it long", so length is what moves the bar most.
 */
function strengthOf(value: string): Strength {
  if (value.length === 0) {
    return { score: 0, label: 'Empty', tone: 'neutral', hint: 'Nothing typed yet.' }
  }
  if (value.length < MIN_LENGTH) {
    return {
      score: 0,
      label: 'Too short',
      tone: 'danger',
      hint: `At least ${MIN_LENGTH} characters. A short passphrase is guessable offline.`,
    }
  }

  let score = 0
  if (value.length >= 12) score += 1
  if (value.length >= 20) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value) && /[^\w\s]/.test(value)) score += 1

  const clamped = Math.min(score, 4) as Strength['score']
  const table: Record<Strength['score'], Omit<Strength, 'score'>> = {
    0: {
      label: 'Weak',
      tone: 'danger',
      hint: 'Longer is the single biggest improvement you can make.',
    },
    1: {
      label: 'Fair',
      tone: 'warning',
      hint: 'Fine for a shared laptop. Add length or a second word for anything more.',
    },
    2: { label: 'Good', tone: 'accent', hint: 'Reasonable. Four unrelated words beats this.' },
    3: { label: 'Strong', tone: 'positive', hint: 'Hard to guess. Make sure you can remember it.' },
    4: {
      label: 'Very strong',
      tone: 'positive',
      hint: 'Write it down somewhere safe — there is no reset link.',
    },
  }

  return { score: clamped, ...table[clamped] }
}

/**
 * The at-rest privacy lock.
 *
 * The copy here matters as much as the controls: this encrypts the database
 * sitting in this browser's storage and nothing else. Overselling it — calling
 * it a login, or implying it protects the deployed site — would be the one
 * genuinely dishonest thing this project could do, so the panel spells out both
 * halves before it lets anyone turn it on.
 */
export function PrivacyLockPanel() {
  const { actions, lock } = usePersonalData()
  const { toast } = useToast()

  const [passphrase, setPassphrase] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [current, setCurrent] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState<'enable' | 'change' | 'disable' | null>(null)

  const supported = isCryptoAvailable()
  const strength = strengthOf(passphrase)

  function resetFields() {
    setPassphrase('')
    setConfirmation('')
    setCurrent('')
    setAcknowledged(false)
    setError(undefined)
  }

  function downloadBackup() {
    const blob = new Blob([actions.exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `portfolio-os-backup-${todayISO()}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast({
      title: 'Backup downloaded',
      description: 'Keep it somewhere the passphrase is not needed to read it.',
      tone: 'positive',
    })
  }

  async function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (passphrase.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`)
      return
    }
    if (passphrase !== confirmation) {
      setError('The two passphrases do not match.')
      return
    }
    if (!acknowledged) {
      setError('Please confirm you understand there is no way to recover the data.')
      return
    }

    setBusy('enable')
    try {
      await lock.enable(passphrase)
      resetFields()
      toast({
        title: 'Privacy lock on',
        description: 'The stored database is now encrypted on this device.',
        tone: 'positive',
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lock could not be turned on.')
    } finally {
      setBusy(null)
    }
  }

  async function handleChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (passphrase.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`)
      return
    }
    if (passphrase !== confirmation) {
      setError('The two new passphrases do not match.')
      return
    }

    setBusy('change')
    try {
      const ok = await lock.change(current, passphrase)
      if (!ok) {
        setError('That current passphrase is not right.')
        return
      }
      resetFields()
      toast({ title: 'Passphrase changed', tone: 'positive' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The passphrase could not be changed.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDisable() {
    if (!current) {
      setError('Enter your current passphrase to turn the lock off.')
      return
    }

    setBusy('disable')
    try {
      const ok = await lock.disable(current)
      if (!ok) {
        setError('That passphrase is not right.')
        return
      }
      resetFields()
      toast({
        title: 'Privacy lock off',
        description: 'The database is stored as plain text in this browser again.',
        tone: 'warning',
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lock could not be turned off.')
    } finally {
      setBusy(null)
    }
  }

  const explanation = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-line bg-surface-muted/60 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Icon name="ShieldCheck" size={14} className="text-positive" />
          What it does protect
        </p>
        <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-muted">
          <li>
            The database sitting in this browser&rsquo;s storage. Someone who opens your laptop and
            reads it through developer tools sees ciphertext.
          </li>
          <li>
            A key derived from your passphrase with PBKDF2-SHA256 ({numberFormat(PBKDF2_ITERATIONS)}{' '}
            iterations) and AES-GCM. The key never leaves this device.
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-line bg-surface-muted/60 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Icon name="CircleAlert" size={14} className="text-warning" />
          What it does not
        </p>
        <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-muted">
          <li>
            It is not a login. There is no server to authenticate against, and anyone can still open
            /dashboard — they just find an unreadable database.
          </li>
          <li>
            It cannot protect you from malware on this machine, and it does nothing for data you
            have already exported or deployed.
          </li>
        </ul>
      </div>
    </div>
  )

  if (!supported) {
    return (
      <div className="space-y-4">
        {explanation}
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft/50 p-3 text-xs leading-relaxed text-ink-muted">
          <Icon name="TriangleAlert" size={15} className="mt-px shrink-0 text-warning" />
          <span>
            Web Crypto is not available in this browser context, so the lock cannot be turned on.
            It needs a secure context — https, or localhost during development.
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={lock.enabled ? 'positive' : 'neutral'} icon={lock.enabled ? 'Lock' : 'LockOpen'}>
          {lock.enabled ? 'Lock is on' : 'Lock is off'}
        </Badge>
        {lock.enabled ? (
          <Button variant="ghost" size="sm" icon="Lock" onClick={() => lock.lock()}>
            Lock now
          </Button>
        ) : null}
      </div>

      {explanation}

      {lock.enabled ? (
        <div className="space-y-4">
          <form onSubmit={(event) => void handleChange(event)} className="space-y-3" noValidate>
            <h3 className="text-sm font-semibold text-ink">Change the passphrase</h3>

            <Field label="Current passphrase">
              <Input
                type={reveal ? 'text' : 'password'}
                value={current}
                onChange={(event) => {
                  setCurrent(event.target.value)
                  if (error) setError(undefined)
                }}
                autoComplete="current-password"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New passphrase" error={error}>
                <Input
                  type={reveal ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(event) => {
                    setPassphrase(event.target.value)
                    if (error) setError(undefined)
                  }}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Repeat the new passphrase">
                <Input
                  type={reveal ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <StrengthMeter strength={strength} show={passphrase.length > 0} />

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" icon="KeyRound" loading={busy === 'change'}>
                Change passphrase
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={reveal ? 'EyeOff' : 'Eye'}
                onClick={() => setReveal((value) => !value)}
              >
                {reveal ? 'Hide' : 'Show'}
              </Button>
            </div>
          </form>

          <div className="rounded-lg border border-line p-3">
            <p className="text-sm font-medium text-ink">Turn the lock off</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              The database is rewritten as plain text in this browser. Enter your current passphrase
              above first.
            </p>
            <Button
              className="mt-2.5"
              variant="secondary"
              size="sm"
              icon="LockOpen"
              loading={busy === 'disable'}
              onClick={() => void handleDisable()}
            >
              Turn off the lock
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void handleEnable(event)} className="space-y-3" noValidate>
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-ink-muted">
              <span className="font-medium text-ink">Export a backup first.</span> If you forget this
              passphrase the data is unreadable — permanently, with no recovery and no reset.
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon="Download"
              onClick={downloadBackup}
              className="sm:shrink-0"
            >
              Export backup
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Passphrase" required error={error}>
              <Input
                type={reveal ? 'text' : 'password'}
                value={passphrase}
                onChange={(event) => {
                  setPassphrase(event.target.value)
                  if (error) setError(undefined)
                }}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Repeat the passphrase" required>
              <Input
                type={reveal ? 'text' : 'password'}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <StrengthMeter strength={strength} show={passphrase.length > 0} />

          <Checkbox
            checked={acknowledged}
            onCheckedChange={setAcknowledged}
            label="I understand that a forgotten passphrase means this data is permanently unreadable, and that there is no recovery of any kind."
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" icon="Lock" loading={busy === 'enable'}>
              Turn on the lock
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={reveal ? 'EyeOff' : 'Eye'}
              onClick={() => setReveal((value) => !value)}
            >
              {reveal ? 'Hide' : 'Show'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function StrengthMeter({ strength, show }: { strength: Strength; show: boolean }) {
  if (!show) return null

  return (
    <div className="space-y-1" aria-live="polite">
      <Progress
        value={strength.score * 25}
        tone={strength.tone}
        size="sm"
        label="Passphrase strength"
      />
      <p className="text-xs text-ink-muted">
        <span className="font-medium text-ink">{strength.label}.</span> {strength.hint}
      </p>
    </div>
  )
}
