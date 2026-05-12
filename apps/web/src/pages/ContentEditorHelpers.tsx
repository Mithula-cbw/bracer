import { useState, useRef, useEffect } from 'react';
import type { SchemaField } from '../../../../packages/core/src/types';

// ─── Toggle ──────────────────────────────────────────────────────────────────
export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-checked={value}
      role="switch"
      className={`relative w-11 h-6 rounded-full border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
        value ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-700 border-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          value ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── TagsInput ────────────────────────────────────────────────────────────────
export function TagsInput({ tags, onChange }: { tags: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap gap-1.5 items-center p-2.5 rounded-xl bg-slate-800 border border-slate-700 min-h-[44px] focus-within:border-indigo-500 transition-colors">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-900/60 text-indigo-300 text-xs border border-indigo-700/40 font-medium">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}
            className="text-indigo-400 hover:text-red-400 transition-colors ml-0.5 leading-none">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        placeholder={tags.length === 0 ? 'Type and press Enter…' : 'Add more…'}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-100 placeholder:text-slate-600 outline-none"
      />
    </div>
  );
}

// ─── FieldInput ───────────────────────────────────────────────────────────────
const inputBase = 'w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors';

export function FieldInput({
  field, value, onChange, inputRef,
}: {
  field: SchemaField;
  value: unknown;
  onChange: (v: unknown) => void;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}) {
  switch (field.type) {
    case 'short-text':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label || field.name}
          className={inputBase}
        />
      );
    case 'long-text':
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label || field.name}
          rows={3}
          className={`${inputBase} resize-y leading-relaxed`}
        />
      );
    case 'number':
      return (
        <input type="number" step="any"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          placeholder="0" className={inputBase} />
      );
    case 'number-nullable':
      return (
        <input type="number" step="any"
          value={value === null || value === undefined ? '' : (value as number)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="null (empty = null)" className={inputBase} />
      );
    case 'float':
      return (
        <input type="number" step="any"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.0" className={inputBase} />
      );
    case 'float-nullable':
      return (
        <input type="number" step="any"
          value={value === null || value === undefined ? '' : (value as string)}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          placeholder="null (empty = null)" className={inputBase} />
      );
    case 'toggle':
      return (
        <div className="flex items-center gap-3 h-[44px]">
          <Toggle value={Boolean(value)} onChange={onChange} />
          <span className="text-sm text-slate-400">{Boolean(value) ? 'On' : 'Off'}</span>
        </div>
      );
    case 'dropdown': {
      const opts = field.options ?? [];
      return (
        <select value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputBase} cursor-pointer`}>
          <option value="" className="bg-slate-800 text-slate-100">— select —</option>
          {opts.map((o) => <option key={o} value={o} className="bg-slate-800 text-slate-100">{o}</option>)}
        </select>
      );
    }
    case 'tags':
      return <TagsInput tags={(value as string[]) ?? []} onChange={onChange as (v: string[]) => void} />;
    case 'object-optional': {
      const enabled = value !== null && value !== undefined && value !== false;
      const objVal = (enabled ? value : {}) as Record<string, unknown>;
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Toggle value={enabled} onChange={(on) => onChange(on ? {} : null)} />
            <span className="text-sm text-slate-400">{enabled ? 'Enabled' : 'Disabled (null)'}</span>
          </div>
          {enabled && (field.subFields ?? []).length > 0 && (
            <div className="ml-4 border-l-2 border-indigo-800/40 pl-4 flex flex-col gap-3 pt-1">
              {(field.subFields ?? []).map((sf) => (
                <div key={sf.id}>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">{sf.label || sf.name}</label>
                  <FieldInput field={sf} value={objVal[sf.name]}
                    onChange={(v) => onChange({ ...objVal, [sf.name]: v })} />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 'list': {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const subFields = field.subFields ?? [];
      return (
        <div className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <div key={idx} className="bg-slate-800/60 rounded-xl p-3 flex flex-col gap-2 relative group/sub border border-slate-700/50">
              {subFields.map((sf) => (
                <div key={sf.id}>
                  <label className="block text-xs text-slate-500 mb-1">{sf.label || sf.name}</label>
                  <FieldInput field={sf} value={item[sf.name]}
                    onChange={(v) => {
                      const next = [...items];
                      next[idx] = { ...item, [sf.name]: v };
                      onChange(next);
                    }} />
                </div>
              ))}
              <button type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-all rounded-md hover:bg-red-500/10">
                ×
              </button>
            </div>
          ))}
          <button type="button"
            onClick={() => onChange([...items, Object.fromEntries(subFields.map((sf) => [sf.name, '']))])}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1 transition-colors">
            + Add item
          </button>
        </div>
      );
    }
    default:
      return (
        <input type="text" value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)} className={inputBase} />
      );
  }
}

// ─── EntryForm ────────────────────────────────────────────────────────────────
export type FormMode = 'add' | 'edit';

function blankValues(fields: SchemaField[]): Record<string, unknown> {
  const blank: Record<string, unknown> = {};
  fields.forEach((f) => {
    blank[f.name] = f.type === 'toggle' ? false
      : f.type === 'tags' ? []
      : f.type === 'number' ? 0
      : f.type === 'number-nullable' ? null
      : f.type === 'float' ? '0.0'
      : f.type === 'float-nullable' ? null
      : f.type === 'object-optional' ? null
      : '';
  });
  return blank;
}

export function EntryForm({
  fields, initial, mode, onSave, onCancel,
}: {
  fields: SchemaField[];
  initial: Record<string, unknown>;
  mode: FormMode;
  onSave: (entry: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...blankValues(fields), ...initial }));
  const firstRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Sync when initial changes (e.g. switching edit target)
  useEffect(() => {
    setValues({ ...blankValues(fields), ...initial });
  }, [initial, fields]);

  const set = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));

  const [errors, setErrors] = useState<string[]>([]);

  const handleSave = () => {
    const missing = fields
      .filter((f) => {
        if (!f.required) return false;
        const v = values[f.name];
        if (v === null || v === undefined || v === '') return true;
        if (Array.isArray(v) && v.length === 0) return true;
        return false;
      })
      .map((f) => f.label || f.name);
    if (missing.length > 0) { setErrors(missing); return; }
    setErrors([]);
    onSave(values);
    if (mode === 'add') {
      setValues(blankValues(fields));
      setTimeout(() => (firstRef.current as HTMLInputElement | null)?.focus(), 30);
    }
  };

  if (fields.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-6">
        No sub-fields defined. <span className="text-slate-600">Edit the schema to add fields.</span>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field, i) => (
          <div
            key={field.id}
            className={field.type === 'long-text' || field.type === 'object-optional' || field.type === 'list' || field.type === 'tags' ? 'sm:col-span-2' : ''}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{field.label || field.name}</label>
              {field.required && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-400 font-bold">REQ</span>
              )}
              <span className="ml-auto text-[10px] text-slate-600 font-mono">{field.type}</span>
            </div>
            <FieldInput
              field={field}
              value={values[field.name]}
              onChange={(v) => set(field.name, v)}
              inputRef={i === 0 ? firstRef : undefined}
            />
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="text-sm px-4 py-2.5 rounded-xl border bg-red-900/20 border-red-700/40 text-red-400">
          Required: {errors.join(', ')}
        </div>
      )}
      <div className="flex items-center gap-3 pt-1 border-t border-slate-800/60">
        <button
          type="button"
          onClick={handleSave}
          className="sm:w-auto w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-900/40"
        >
          {mode === 'add' ? '+ Save Entry' : '✓ Save Changes'}
        </button>
        {mode === 'edit' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
