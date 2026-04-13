import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-content-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full h-10 px-3 rounded bg-surface-tertiary border text-sm text-content-primary placeholder:text-content-tertiary transition-colors focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed ${
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
              : 'border-border focus:border-brand-500 focus:ring-brand-500'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-danger-500">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
