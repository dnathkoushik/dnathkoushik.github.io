/**
 * The gate in front of an encrypted private database.
 *
 * `PersonalLayout` renders this INSTEAD of the dashboard shell whenever
 * `status === 'locked'`, so it owns the page: it provides the `<main>`, the
 * single `<h1>` and the way back out to the portfolio. Nothing here talks to
 * storage directly — `lock.unlock()` either derives a working key or it does
 * not, and a wrong passphrase is an ordinary, expected outcome rather than an
 * error state to apologise for.
 */
import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { usePersonalData } from '@/providers/personalDataContext'

const WRONG_PASSPHRASE =
  'That passphrase did not unlock this database. Check for a stray capital or a different keyboard layout.'

export function LockScreen() {
  useDocumentMeta({
    title: 'Locked',
    description: 'This dashboard is private and encrypted in this browser.',
    noindex: true,
  })

  const { lock } = usePersonalData()
  const inputId = useId()
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const inputRef = useRef<HTMLInputElement>(null)

  const [passphrase, setPassphrase] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const value = passphrase
    if (value.length === 0) {
      setError('Enter your passphrase to continue.')
      inputRef.current?.focus()
      return
    }

    setBusy(true)
    setError(null)

    let message: string | null = null
    try {
      const unlocked = await lock.unlock(value)
      if (!unlocked) message = WRONG_PASSPHRASE
    } catch (cause) {
      message =
        cause instanceof Error && cause.message
          ? cause.message
          : 'The lock could not be checked in this browser.'
    }

    setBusy(false)

    if (message === null) {
      // The provider swaps this screen for the dashboard on the next render.
      setPassphrase('')
      return
    }

    setError(message)
    // Put the caret back where the correction has to happen.
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="animate-rise">
        <Card>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent"
              >
                <Icon name="Lock" size={22} />
              </span>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  This dashboard is locked
                </h1>
                <p className="text-sm leading-relaxed text-ink-muted">
                  Enter the passphrase you set on this device to decrypt your data.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={inputId} className="text-sm font-medium text-ink">
                  Passphrase
                </label>

                <div className="relative">
                  <Input
                    ref={inputRef}
                    id={inputId}
                    name="passphrase"
                    type={revealed ? 'text' : 'password'}
                    autoFocus
                    autoComplete="current-password"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    invalid={error !== null}
                    aria-describedby={error ? `${errorId} ${hintId}` : hintId}
                    value={passphrase}
                    onChange={(event) => {
                      setPassphrase(event.target.value)
                      if (error) setError(null)
                    }}
                    className="h-12 pr-12 pointer-coarse:h-12"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setRevealed((previous) => !previous)
                      inputRef.current?.focus()
                    }}
                    aria-label={revealed ? 'Hide passphrase' : 'Show passphrase'}
                    aria-pressed={revealed}
                    className="absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-md text-ink-faint outline-accent transition-colors duration-150 hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <Icon name={revealed ? 'EyeOff' : 'Eye'} size={17} />
                  </button>
                </div>

                <p role="alert" className="min-h-4">
                  {error ? (
                    <span
                      id={errorId}
                      className="flex items-start gap-1.5 text-xs leading-relaxed text-danger"
                    >
                      <Icon name="CircleAlert" size={13} className="mt-px" />
                      <span>{error}</span>
                    </span>
                  ) : null}
                </p>
              </div>

              <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} icon="LockOpen">
                {busy ? 'Unlocking' : 'Unlock'}
              </Button>
            </form>

            <p id={hintId} className="text-xs leading-relaxed text-ink-faint">
              This passphrase decrypts data that is stored only in this browser. It is never sent
              anywhere and there is no reset link, so if it is forgotten the encrypted data cannot
              be read again — clearing this site&rsquo;s data is the only way to start over.
            </p>

            <div className="flex justify-center border-t border-line pt-4">
              <ButtonLink to={PUBLIC_ROUTES.home} variant="ghost" size="sm" icon="ArrowLeft">
                Back to portfolio
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
