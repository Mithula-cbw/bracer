import { useState, useRef, type KeyboardEvent } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  maxTags?: number;
}

export function TagInput({
  tags,
  onChange,
  placeholder = 'Add tag…',
  label,
  error,
  disabled = false,
  maxTags,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) return;
    if (maxTags && tags.length >= maxTags) return;
    onChange([...tags, tag]);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
      )}

      {/* Tag + input container */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={[
          'flex flex-wrap gap-1.5 px-2.5 py-2 rounded-[var(--radius-md)] min-h-[40px] cursor-text transition-all duration-150',
          'bg-[var(--bg-secondary)] border border-[var(--border)]',
          'focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)]',
          error ? 'border-[var(--error)]' : '',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {tags.map((tag, i) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(i); }}
                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-[var(--accent)] hover:text-white transition-colors duration-100"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            )}
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          placeholder={(!maxTags || tags.length < maxTags) ? placeholder : ''}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(inputValue)}
          className="flex-1 min-w-[100px] bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none disabled:cursor-not-allowed"
        />
      </div>

      {error && <p className="text-xs text-[var(--error)]">{error}</p>}
      {maxTags && (
        <p className="text-xs text-[var(--text-muted)]">{tags.length}/{maxTags} tags</p>
      )}
    </div>
  );
}
