import { type TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, rows = 4, ...props }, ref) => {
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
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={[
            'w-full px-3 py-2 text-sm rounded-[var(--radius-md)] outline-none resize-y transition-all duration-150',
            'bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]',
            'font-mono', // useful for JSON / code content
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
Textarea.displayName = 'Textarea';
