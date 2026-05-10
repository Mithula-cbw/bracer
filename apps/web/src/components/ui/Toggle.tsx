interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, label, disabled = false, id }: ToggleProps) {
  const toggleId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <label
      htmlFor={toggleId}
      className={[
        'inline-flex items-center gap-2.5 cursor-pointer select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <span className="relative">
        <input
          type="checkbox"
          id={toggleId}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        {/* Track */}
        <span
          className={[
            'block w-10 h-5.5 rounded-full transition-colors duration-200',
            'bg-[var(--bg-tertiary)] border border-[var(--border)]',
            'peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)]',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-1',
          ].join(' ')}
        />
        {/* Thumb */}
        <span
          className={[
            'absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm',
            'transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0',
          ].join(' ')}
        />
      </span>
      {label && (
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      )}
    </label>
  );
}
