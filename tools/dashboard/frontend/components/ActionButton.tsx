/**
 * Reusable action button that disables itself and shows a DaisyUI loading
 * animation while its action is in progress.
 *
 * Accepts an `onClick` handler that may return a `Promise` — the button
 * stays in its loading state until the promise settles.
 */

import { useCallback, useState } from 'preact/hooks'

/** DaisyUI loading animation variants. */
export type LoadingVariant =
  | 'loading-spinner'
  | 'loading-dots'
  | 'loading-ring'
  | 'loading-ball'
  | 'loading-bars'
  | 'loading-infinity'

interface ActionButtonProps {
  /** Button label text. */
  label: string
  /** Optional label shown while loading. Defaults to {@link label}. */
  loadingLabel?: string
  /** Additional CSS classes applied to the `<button>` element. */
  className?: string
  /** Inline styles applied to the `<button>` element. */
  style?: Record<string, string>
  /** DaisyUI loading animation variant. Defaults to `loading-spinner`. */
  loading?: LoadingVariant
  /** Whether the button should be disabled externally (e.g. another action is running). */
  disabled?: boolean
  /** Click handler — may be sync or async. Button stays loading until it resolves. */
  onClick: () => void | Promise<void>
}

/**
 * A button that transitions to a disabled+loading state on click.
 * Automatically recovers when the `onClick` handler completes or throws.
 */
export function ActionButton({
  label,
  loadingLabel,
  className = '',
  style,
  loading = 'loading-spinner',
  disabled = false,
  onClick,
}: ActionButtonProps) {
  const [busy, setBusy] = useState(false)

  const handleClick = useCallback(async () => {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onClick()
    } finally {
      setBusy(false)
    }
  }, [busy, disabled, onClick])

  return (
    <button
      type="button"
      className={className}
      style={style}
      disabled={disabled || busy}
      onClick={handleClick}
    >
      {busy && <span className={`loading ${loading} loading-sm`} />}
      {busy ? (loadingLabel ?? label) : label}
    </button>
  )
}
