import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'w-full px-3 py-2 text-sm rounded-[var(--radius-md)] outline-none transition-all duration-150',
            'bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]',
            error ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]' : '',
            className,
          ].join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-[var(--error)]">{error}</p>}
        {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
