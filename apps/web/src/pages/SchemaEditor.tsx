import { useState, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore } from '../store/projectStore';
import { Modal } from '../components/ui/Modal';
import { inferSchemaFromJSON } from '../../../../packages/core/src/schemaInference';
import type { Schema, SchemaField, FieldType } from '../../../../packages/core/src/types';

// ─── constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; icon: string; label: string }[] = [
  { value: 'short-text',      icon: 'Aa', label: 'Short Text' },
  { value: 'long-text',       icon: '¶',  label: 'Long Text' },
  { value: 'number',          icon: '#',  label: 'Number' },
  { value: 'number-nullable', icon: '#?', label: 'Number (nullable)' },
  { value: 'float',           icon: '.#', label: 'Float' },
  { value: 'float-nullable',  icon: '.#?',label: 'Float (nullable)' },
  { value: 'toggle',          icon: '◐',  label: 'Toggle' },
  { value: 'dropdown',        icon: '▾',  label: 'Dropdown' },
  { value: 'tags',            icon: '⊞',  label: 'Tags' },
  { value: 'object-optional', icon: '{}', label: 'Object (optional)' },
  { value: 'list',            icon: '[]', label: 'List' },
];

const TYPE_ICON: Record<FieldType, string> = Object.fromEntries(
  FIELD_TYPES.map((t) => [t.value, t.icon])
) as Record<FieldType, string>;

const uid = () => crypto.randomUUID();
const blankField = (): SchemaField => ({ id: uid(), name: '', label: '', type: 'short-text', required: false });

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

// ─── ChipEditor ───────────────────────────────────────────────────────────────

const CHIP_COLORS = [
  'bg-indigo-500/10 border-indigo-500/20 text-indigo-300',
  'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  'bg-amber-500/10 border-amber-500/20 text-amber-300',
  'bg-rose-500/10 border-rose-500/20 text-rose-300',
  'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
  'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300',
];

function ChipEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !options.includes(v)) onChange([...options, v]);
    setDraft('');
  };
  return (
    <div className="mt-1 sm:mt-2 ml-10 sm:ml-[3.25rem] flex flex-col gap-2.5 p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 shadow-inner">
      <div className="flex flex-wrap gap-2 items-center min-h-[28px]">
        {options.length === 0 && (
          <span className="text-xs text-slate-500 italic">No options defined yet.</span>
        )}
        {options.map((opt, i) => {
          const color = CHIP_COLORS[i % CHIP_COLORS.length];
          return (
            <span key={opt} className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium shadow-sm transition-all hover:brightness-110 ${color}`}>
              {opt}
              <button type="button" onClick={() => onChange(options.filter((o) => o !== opt))}
                className="w-4 h-4 rounded-md flex items-center justify-center opacity-70 hover:opacity-100 hover:text-red-400 hover:bg-red-400/20 transition-all leading-none focus:outline-none">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Type option name..."
          className="flex-1 max-w-[200px] px-3 py-1.5 text-xs rounded-md bg-slate-950/50 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors shadow-inner"
        />
        <button type="button" onClick={add} disabled={!draft.trim()}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 border border-slate-700 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white disabled:opacity-50 disabled:hover:bg-slate-800 disabled:hover:border-slate-700 disabled:text-slate-500 text-slate-300 transition-all shadow-sm">
          Add
        </button>
      </div>
    </div>
  );
}

// ─── SubFieldList ─────────────────────────────────────────────────────────────

function SubFieldList({ fields, depth, onChange }: { fields: SchemaField[]; depth: number; onChange: (f: SchemaField[]) => void }) {
  const sensors = useDndSensors();
  const handleDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    const oi = fields.findIndex((f) => f.id === active.id);
    const ni = fields.findIndex((f) => f.id === over.id);
    onChange(arrayMove(fields, oi, ni));
  };
  const update = (id: string, u: SchemaField) => onChange(fields.map((f) => (f.id === id ? u : f)));
  const remove = (id: string) => onChange(fields.filter((f) => f.id !== id));

  return (
    <div className="ml-8 mt-2 border-l-2 border-indigo-800/60 pl-4 flex flex-col gap-1.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {fields.map((sf) => (
            <FieldRow key={sf.id} field={sf} depth={depth} onChange={(u) => update(sf.id, u)} onDelete={() => remove(sf.id)} />
          ))}
        </SortableContext>
      </DndContext>
      {fields.length === 0 && (
        <div className="text-xs text-slate-600 py-1 italic">No sub-fields yet</div>
      )}
      <button type="button" onClick={() => onChange([...fields, blankField()])}
        className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors self-start font-medium">
        <span className="text-sm">+</span> Add sub-field
      </button>
    </div>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({ field, depth = 0, onChange, onDelete }: {
  field: SchemaField; depth?: number;
  onChange: (u: SchemaField) => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const [subOpen, setSubOpen] = useState(true);
  const hasSubFields = field.type === 'object-optional' || field.type === 'list';

  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex flex-col mb-2">
      {/* Card */}
      <div className={`group flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl border transition-all duration-200 ${
        depth > 0
          ? 'bg-slate-900/50 border-slate-800/60 hover:border-slate-700/80 hover:bg-slate-900'
          : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 hover:shadow-md hover:bg-slate-900'
      } ${isDragging ? 'shadow-2xl scale-[1.02] border-indigo-500/50 bg-slate-900 z-10' : ''}`}>

        {/* Drag handle */}
        <button type="button" {...attributes} {...listeners}
          className="text-slate-600 hover:text-slate-300 hover:bg-slate-800 p-1 sm:p-1.5 rounded-md cursor-grab active:cursor-grabbing flex-shrink-0 touch-none transition-colors">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
            <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
            <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
          </svg>
        </button>

        {/* Type icon badge */}
        <span className="hidden sm:flex flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 items-center justify-center text-[11px] font-mono font-bold text-indigo-400 select-none shadow-sm">
          {TYPE_ICON[field.type]}
        </span>

        {/* Field name */}
        <input
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.target.value, label: e.target.value })}
          placeholder="field_name"
          className="flex-1 w-full sm:w-auto min-w-[120px] px-2 sm:px-3 py-1.5 text-sm rounded-lg bg-slate-950/50 border border-slate-800/80 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 focus:bg-slate-950 font-mono transition-all shadow-inner"
        />

        {/* Type select */}
        <div className="relative flex-shrink-0">
          <select
            value={field.type}
            onChange={(e) => onChange({ ...field, type: e.target.value as FieldType, options: [], subFields: [] })}
            className="appearance-none pl-2 sm:pl-3 pr-6 sm:pr-8 py-1.5 text-xs rounded-lg bg-slate-950/50 border border-slate-800/80 text-slate-300 outline-none focus:border-indigo-500 cursor-pointer transition-all hover:border-slate-600 font-medium shadow-inner"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-slate-900 text-slate-300">{t.icon} {t.label}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Required */}
        <button type="button" onClick={() => onChange({ ...field, required: !field.required })}
          title="Toggle required"
          className={`flex-shrink-0 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] rounded-lg border font-bold tracking-widest transition-all uppercase ${
            field.required
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
              : 'bg-transparent border-slate-800 text-slate-600 hover:border-slate-600 hover:text-slate-400'
          }`}>
          Req
        </button>

        {/* Expand sub-fields */}
        {hasSubFields && (
          <button type="button" onClick={() => setSubOpen((o) => !o)}
            className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center transition-colors ${subOpen ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
            <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${subOpen ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Delete */}
        <button type="button" onClick={onDelete}
          className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors sm:opacity-0 group-hover:opacity-100">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Dropdown chips */}
      {field.type === 'dropdown' && (
        <ChipEditor options={field.options ?? []} onChange={(opts) => onChange({ ...field, options: opts })} />
      )}

      {/* Sub-fields */}
      {hasSubFields && subOpen && (
        <SubFieldList
          fields={field.subFields ?? []}
          depth={depth + 1}
          onChange={(subs) => onChange({ ...field, subFields: subs })}
        />
      )}
    </div>
  );
}

// ─── FieldList ────────────────────────────────────────────────────────────────

function FieldList({ fields, onChange, label, addLabel, hint }: {
  fields: SchemaField[]; onChange: (f: SchemaField[]) => void;
  label: string; addLabel: string; hint?: string;
}) {
  const sensors = useDndSensors();
  const handleDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    onChange(arrayMove(fields, fields.findIndex((f) => f.id === active.id), fields.findIndex((f) => f.id === over.id)));
  };
  const update = (id: string, u: SchemaField) => onChange(fields.map((f) => (f.id === id ? u : f)));
  const remove = (id: string) => onChange(fields.filter((f) => f.id !== id));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50 tabular-nums">
          {fields.length} {fields.length === 1 ? 'field' : 'fields'}
        </span>
      </div>

      {fields.length === 0 ? (
        <button type="button" onClick={() => onChange([blankField()])}
          className="w-full border-2 border-dashed border-slate-800/80 hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-xl py-10 flex flex-col items-center gap-3 text-slate-500 hover:text-indigo-400 transition-all group cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-slate-900 group-hover:bg-indigo-500/10 flex items-center justify-center transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <span className="text-sm font-medium tracking-wide">{addLabel}</span>
        </button>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {fields.map((field) => (
                  <FieldRow key={field.id} field={field} onChange={(u) => update(field.id, u)} onDelete={() => remove(field.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button type="button" onClick={() => onChange([...fields, blankField()])}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {addLabel}
          </button>
        </>
      )}

      {hint && <p className="mt-3 text-xs text-slate-600 leading-relaxed">{hint}</p>}
    </section>
  );
}

// ─── ImportPanel ──────────────────────────────────────────────────────────────

function ImportPanel({ onDetect, onClear }: { onDetect: (s: Schema) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  const [detected, setDetected] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [isClearModalOpen, setClearModalOpen] = useState(false);
  const fileRef = useState<HTMLInputElement | null>(null);

  const confirmClear = () => {
    if (detected) onClear();
    setJson('');
    setError('');
    setDetected(false);
    setClearModalOpen(false);
  };

  const handleClearClick = () => {
    if (detected) setClearModalOpen(true);
    else confirmClear();
  };

  const loadText = (text: string) => {
    setJson(text);
    setError('');
    setDetected(false);
  };

  const readFile = (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setError('Please upload a .json file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => loadText((e.target?.result as string) ?? '');
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = '';
  };

  const handleDetect = () => {
    setError(''); setDetected(false);
    try {
      const parsed = JSON.parse(json);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      onDetect(inferSchemaFromJSON(obj, Array.isArray(parsed) ? parsed : [parsed]));
      setDetected(true);
    } catch { setError('Invalid JSON — paste a valid object or array.'); }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800/30 transition-all">
        <span className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-md bg-indigo-900/60 border border-indigo-800/60 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </span>
          Import from example JSON
          <span className="text-xs text-slate-600 font-normal">— auto-detect fields</span>
        </span>
        <svg className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 border-t border-slate-800 flex flex-col gap-3">
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Upload a <code className="text-slate-400">.json</code> file, drag &amp; drop it, or paste JSON below.
            Fields will be auto-detected.
          </p>

          {!json.trim() && (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 transition-all cursor-pointer ${
                  dragging
                    ? 'border-indigo-500 bg-indigo-950/40 scale-[1.01]'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-800/20'
                }`}
                onClick={() => fileRef[0]?.click()}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  dragging ? 'bg-indigo-600/30' : 'bg-slate-800'
                }`}>
                  <svg className={`w-5 h-5 transition-colors ${dragging ? 'text-indigo-400' : 'text-slate-500'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.533 7.17A4.5 4.5 0 0117.25 19.5H6.75z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-medium transition-colors ${dragging ? 'text-indigo-300' : 'text-slate-400'}`}>
                    {dragging ? 'Drop to load' : 'Drop JSON file here'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">or click to browse</p>
                </div>
                <input
                  ref={(el) => { fileRef[0] = el; }}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileInput}
                  className="sr-only"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-slate-800" />
                <span className="text-xs text-slate-600 font-medium">or paste</span>
                <div className="flex-1 border-t border-slate-800" />
              </div>
            </>
          )}

          {/* Textarea */}
          <textarea
            value={json}
            onChange={(e) => loadText(e.target.value)}
            placeholder={'{\n  "title": "My Card",\n  "difficulty": "easy",\n  "cards": [{ "text": "..." }]\n}'}
            rows={6}
            className="w-full px-3 py-2.5 text-xs font-mono rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-700 outline-none focus:border-indigo-500 resize-y leading-relaxed tracking-tight"
          />

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
              {error}
            </p>
          )}

          {detected && (
            <div className="px-3 py-2 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Review detected fields below. Change any types or add dropdown options as needed.
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" onClick={handleDetect} disabled={!json.trim()}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-sm shadow-indigo-900/50">
              Detect Fields
            </button>
            {json.trim() && (
              <button type="button" onClick={handleClearClick}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium border border-transparent hover:border-red-500/20">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal 
        isOpen={isClearModalOpen} 
        onClose={() => setClearModalOpen(false)} 
        title="Clear Detected Fields"
        actions={
          <>
            <button onClick={() => setClearModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">Cancel</button>
            <button onClick={confirmClear} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-sm shadow-red-900/50">Clear Fields</button>
          </>
        }
      >
        <p>Clearing will also remove all detected fields from the schema editor below. Are you sure you want to continue?</p>
      </Modal>
    </div>
  );
}

// ─── SchemaEditor ─────────────────────────────────────────────────────────────

export function SchemaEditor() {
  const { id: projectId, schemaId } = useParams<{ id: string; schemaId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const addSchema = useProjectStore((s) => s.addSchema);
  const updateSchema = useProjectStore((s) => s.updateSchema);

  const isNew = schemaId === 'new';
  const existing = project?.schemas.find((s) => s.id === schemaId);

  const locationState = location.state as { inferredSchema?: Schema } | undefined;
  const initialSchemaName = existing?.name ?? (locationState?.inferredSchema?.name ? `${locationState.inferredSchema.name} - ${new Date().toISOString().split('T')[0]}` : '');
  const initialRootFields = existing?.rootFields ?? locationState?.inferredSchema?.rootFields ?? [];
  const initialListFields = existing?.listFields ?? locationState?.inferredSchema?.listFields ?? [];

  const [schemaName, setSchemaName] = useState(initialSchemaName);
  const [rootFields, setRootFields] = useState<SchemaField[]>(initialRootFields);
  const [listFields, setListFields] = useState<SchemaField[]>(initialListFields);
  const [saveError, setSaveError] = useState('');

  const isValid = schemaName.trim().length > 0 && (rootFields.length + listFields.length) > 0;

  // Modals state
  const [pendingInferredSchema, setPendingInferredSchema] = useState<Schema | null>(null);
  const [isBackModalOpen, setBackModalOpen] = useState(false);

  // isDirty check
  const isDirty = useMemo(() => {
    if (!existing) {
      return schemaName.trim() !== '' || rootFields.length > 0 || listFields.length > 0;
    }
    return (
      schemaName.trim() !== existing.name ||
      JSON.stringify(rootFields) !== JSON.stringify(existing.rootFields) ||
      JSON.stringify(listFields) !== JSON.stringify(existing.listFields)
    );
  }, [existing, schemaName, rootFields, listFields]);

  const applyInferred = (inferred: Schema) => {
    setRootFields(inferred.rootFields);
    setListFields(inferred.listFields);
    if (!schemaName || schemaName.startsWith('Inferred Schema')) {
      const date = new Date().toISOString().split('T')[0];
      setSchemaName(`${inferred.name} - ${date}`);
    }
  };

  const handleImport = (inferred: Schema) => {
    if (rootFields.length > 0 || listFields.length > 0) {
      setPendingInferredSchema(inferred);
    } else {
      applyInferred(inferred);
    }
  };

  const confirmReplace = () => {
    if (pendingInferredSchema) applyInferred(pendingInferredSchema);
    setPendingInferredSchema(null);
  };

  // Handle Back
  const handleBack = () => {
    if (isDirty) setBackModalOpen(true);
    else navigate(`/project/${projectId}`);
  };

  const confirmBack = () => {
    navigate(`/project/${projectId}`);
  };

  const handleSave = () => {
    if (!isValid) {
      setSaveError('Schema needs a name and at least 1 field to save.');
      setTimeout(() => setSaveError(''), 4000);
      return;
    }
    if (!projectId || !project) return;

    const conflict = project.schemas.find(
      (s) => s.name.trim().toLowerCase() === schemaName.trim().toLowerCase() && s.id !== (isNew ? '' : existing?.id)
    );

    if (conflict) {
      setSaveError('A schema with this name already exists in this project.');
      setTimeout(() => setSaveError(''), 4000);
      return;
    }

    const schema: Schema = {
      id: isNew ? uid() : (existing?.id ?? uid()),
      name: schemaName.trim(), rootFields, listFields,
    };
    if (isNew) addSchema(projectId, schema);
    else updateSchema(projectId, schema.id, { name: schema.name, rootFields, listFields });
    navigate(`/project/${projectId}`);
  };

  if (!project) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
      Project not found.{' '}
      <button onClick={() => navigate('/')} className="ml-2 text-indigo-400 hover:underline">Go home</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 sm:h-16 flex items-center gap-3">
          <button type="button" onClick={handleBack}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:border-slate-600 transition-all flex-shrink-0 group shadow-sm">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex flex-col ml-1 justify-center flex-1 min-w-0">
             <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium truncate mb-0.5">
                {project.name}
             </div>
             <div className="flex items-center gap-3">
              <input
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                placeholder="Schema name…"
                className="bg-transparent border-none outline-none text-base sm:text-lg font-bold text-slate-100 placeholder:text-slate-700 w-full"
              />
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400 shadow-sm flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${isValid ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
            <span className="tabular-nums">{rootFields.length + listFields.length}</span> fields
          </div>
        </div>
      </div>

      {/* Error Banner */}
      <div className={`fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-out ${saveError ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-6 scale-90 pointer-events-none'}`}>
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-red-900/20 flex items-center gap-2 backdrop-blur-md">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {saveError}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <ImportPanel 
          onDetect={handleImport} 
          onClear={() => {
            setRootFields([]);
            setListFields([]);
          }}
        />

        <div className="bg-slate-900/40 sm:rounded-xl border-y sm:border border-slate-800/80 p-4 sm:p-6 hover:border-slate-700/80 transition-colors sm:shadow-sm -mx-4 sm:mx-0">
          <FieldList
            label="Root Fields"
            addLabel="Add root field"
            fields={rootFields}
            onChange={setRootFields}
            hint="Metadata defined once per content list — e.g. pack name, schema version."
          />
        </div>

        <div className="bg-slate-900/40 sm:rounded-xl border-y sm:border border-slate-800/80 p-4 sm:p-6 hover:border-slate-700/80 transition-colors sm:shadow-sm -mx-4 sm:mx-0">
          <FieldList
            label="List Fields"
            addLabel="Add list field"
            fields={listFields}
            onChange={setListFields}
            hint="Shape of each repeating entry in your content list."
          />
        </div>
      </div>

      {/* Fixed save button */}
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto z-40 flex items-center justify-end gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-5 py-3 sm:py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-900/50 hover:shadow-indigo-800/60 hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V7l-4-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 3v4H7V3" />
          </svg>
          Save Schema
        </button>
      </div>

      <Modal 
        isOpen={!!pendingInferredSchema} 
        onClose={() => setPendingInferredSchema(null)} 
        title="Replace Fields?"
        actions={
          <>
            <button onClick={() => setPendingInferredSchema(null)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">Cancel</button>
            <button onClick={confirmReplace} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-sm shadow-red-900/50">Replace</button>
          </>
        }
      >
        <p>This will overwrite the current fields in the editor with the newly detected ones. Continue?</p>
      </Modal>

      <Modal 
        isOpen={isBackModalOpen} 
        onClose={() => setBackModalOpen(false)} 
        title="Discard Changes?"
        actions={
          <>
            <button onClick={() => setBackModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">Cancel</button>
            <button onClick={confirmBack} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-sm shadow-red-900/50">Discard</button>
          </>
        }
      >
        <p>You have unsaved edits. Are you sure you want to leave without saving?</p>
      </Modal>
    </div>
  );
}
