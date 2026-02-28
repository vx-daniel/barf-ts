/**
 * Async button with loading state — wraps MUI Button with busy indicator.
 */
import type React from 'react'
import { useState, useCallback } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

interface ActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick: () => void | Promise<void>
  loading?: boolean
}

export function ActionButton({
  onClick,
  loading: externalLoading,
  disabled,
  children,
  ...props
}: ActionButtonProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const isLoading = externalLoading ?? busy

  const handleClick = useCallback(async () => {
    if (isLoading) return
    setBusy(true)
    try {
      await onClick()
    } finally {
      setBusy(false)
    }
  }, [onClick, isLoading])

  return (
    <Button
      {...props}
      disabled={disabled || isLoading}
      onClick={() => void handleClick()}
    >
      {isLoading ? (
        <CircularProgress size={14} sx={{ mr: 0.5 }} color="inherit" />
      ) : null}
      {children}
    </Button>
  )
}
