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
      <button
        type="button"
        id={toggleId}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900',
          checked ? 'bg-indigo-600' : 'bg-slate-700',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
      {label && (
        <span className="text-sm text-slate-300">{label}</span>
      )}
    </label>
  );
}
