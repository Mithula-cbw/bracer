import { useState, useRef, useEffect, useId } from 'react';

export interface DropdownOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  label,
  error,
  disabled = false,
  className = '',
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId();
  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`relative flex flex-col gap-1 ${className}`} ref={ref}>
      {label && (
        <label htmlFor={uid} className="text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        id={uid}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={[
          'w-full flex items-center justify-between px-3 py-2 text-sm rounded-[var(--radius-md)] transition-all duration-150',
          'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]',
          open ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : '',
          error ? 'border-[var(--error)]' : '',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--accent)]',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'text-[var(--text-muted)]'}>
          {selected ? selected.label : placeholder}
        </span>
        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Option list */}
      {open && (
        <ul
          role="listbox"
          className={[
            'absolute z-50 top-full mt-1 w-full max-h-56 overflow-y-auto',
            'bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-lg py-1',
          ].join(' ')}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                if (!opt.disabled) { onChange(opt.value); setOpen(false); }
              }}
              className={[
                'px-3 py-2 text-sm cursor-pointer transition-colors duration-100',
                opt.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--bg-tertiary)]',
                opt.value === value
                  ? 'text-[var(--accent)] font-medium bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]'
                  : 'text-[var(--text-primary)]',
              ].join(' ')}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-[var(--error)]">{error}</p>}
    </div>
  );
}
