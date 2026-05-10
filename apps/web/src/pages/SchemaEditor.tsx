import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore } from '../store/projectStore';
import { inferSchemaFromJSON } from '../../../../packages/core/src/schemaInference';
import type { Schema, SchemaField, FieldType } from '../../../../packages/core/src/types';

// ─── constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'short-text',     label: 'Short Text' },
  { value: 'long-text',      label: 'Long Text' },
  { value: 'number',         label: 'Number' },
  { value: 'number-nullable',label: 'Number (nullable)' },
  { value: 'toggle',         label: 'Toggle' },
  { value: 'dropdown',       label: 'Dropdown' },
  { value: 'tags',           label: 'Tags' },
  { value: 'object-optional',label: 'Object (optional)' },
  { value: 'list',           label: 'List' },
];

const uid = () => crypto.randomUUID();
const blankField = (): SchemaField => ({
  id: uid(), name: '', label: '', type: 'short-text', required: false,
});

// ─── sensors factory (called at top of each component, not in JSX) ───────────

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

// ─── ChipEditor ───────────────────────────────────────────────────────────────

function ChipEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !options.includes(v)) onChange([...options, v]);
    setDraft('');
  };
  return (
    <div className="mt-2 ml-6 flex flex-wrap gap-1.5 items-center">
      {options.map((opt) => (
        <span key={opt} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-700 text-indigo-200 text-xs">
          {opt}
          <button type="button" onClick={() => onChange(options.filter((o) => o !== opt))} className="text-indigo-400 hover:text-red-400 transition-colors leading-none">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        placeholder="Add option…"
        className="px-2 py-0.5 text-xs rounded bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500 w-28"
      />
    </div>
  );
}

// ─── SubFieldList (own DndContext — sensors hoisted inside component) ─────────

function SubFieldList({
  fields,
  depth,
  onChange,
}: {
  fields: SchemaField[];
  depth: number;
  onChange: (fields: SchemaField[]) => void;
}) {
  // ✅ hooks at top level of component, not inside JSX
  const sensors = useDndSensors();

  const handleDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex((f) => f.id === active.id);
    const newIdx = fields.findIndex((f) => f.id === over.id);
    onChange(arrayMove(fields, oldIdx, newIdx));
  };

  const update = (id: string, updated: SchemaField) =>
    onChange(fields.map((f) => (f.id === id ? updated : f)));
  const remove = (id: string) => onChange(fields.filter((f) => f.id !== id));

  return (
    <div className="ml-6 mt-1 flex flex-col gap-1 border-l-2 border-slate-800 pl-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {fields.map((sf) => (
            <FieldRow
              key={sf.id}
              field={sf}
              depth={depth}
              onChange={(u) => update(sf.id, u)}
              onDelete={() => remove(sf.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={() => onChange([...fields, blankField()])}
        className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors self-start"
      >
        <span className="text-base leading-none">+</span> Add sub-field
      </button>
    </div>
  );
}

// ─── FieldRow (sortable) ──────────────────────────────────────────────────────

interface FieldRowProps {
  field: SchemaField;
  depth?: number;
  onChange: (updated: SchemaField) => void;
  onDelete: () => void;
}

function FieldRow({ field, depth = 0, onChange, onDelete }: FieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const [subOpen, setSubOpen] = useState(true);
  const hasSubFields = field.type === 'object-optional' || field.type === 'list';

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-0">
      {/* Row */}
      <div className={`flex items-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
        depth > 0 ? 'border-slate-800/60 bg-slate-900/40' : 'border-slate-800 bg-slate-900'
      } ${isDragging ? 'shadow-xl' : ''}`}>

        {/* Drag handle */}
        <button type="button" {...attributes} {...listeners}
          className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 000 2h12a1 1 0 100-2H4zM4 11a1 1 0 000 2h12a1 1 0 100-2H4zM4 15a1 1 0 000 2h6a1 1 0 100-2H4z" />
          </svg>
        </button>

        {/* Field name */}
        <input
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.target.value, label: e.target.value })}
          placeholder="field_name"
          className="flex-1 min-w-0 px-2 py-1 text-sm rounded bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 font-mono"
        />

        {/* Type */}
        <select
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value as FieldType, options: [], subFields: [] })}
          className="px-2 py-1 text-sm rounded bg-slate-800 border border-slate-700 text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Required */}
        <button
          type="button"
          onClick={() => onChange({ ...field, required: !field.required })}
          title="Toggle required"
          className={`px-2 py-1 text-xs rounded border transition-colors font-medium flex-shrink-0 ${
            field.required
              ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
              : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
          }`}
        >
          REQ
        </button>

        {/* Expand sub-fields */}
        {hasSubFields && (
          <button
            type="button"
            onClick={() => setSubOpen((o) => !o)}
            title={subOpen ? 'Collapse' : 'Expand'}
            className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
          >
            <svg className={`w-4 h-4 transition-transform ${subOpen ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Delete */}
        <button type="button" onClick={onDelete} title="Delete field"
          className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Dropdown options */}
      {field.type === 'dropdown' && (
        <ChipEditor
          options={field.options ?? []}
          onChange={(opts) => onChange({ ...field, options: opts })}
        />
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

// ─── FieldList (top-level section) ───────────────────────────────────────────

function FieldList({
  fields,
  onChange,
  label,
  addLabel,
  hint,
}: {
  fields: SchemaField[];
  onChange: (f: SchemaField[]) => void;
  label: string;
  addLabel: string;
  hint?: string;
}) {
  const sensors = useDndSensors();

  const handleDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex((f) => f.id === active.id);
    const newIdx = fields.findIndex((f) => f.id === over.id);
    onChange(arrayMove(fields, oldIdx, newIdx));
  };

  const update = (id: string, updated: SchemaField) =>
    onChange(fields.map((f) => (f.id === id ? updated : f)));
  const remove = (id: string) => onChange(fields.filter((f) => f.id !== id));

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</h3>
        <span className="text-xs text-slate-600">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                onChange={(u) => update(field.id, u)}
                onDelete={() => remove(field.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => onChange([...fields, blankField()])}
        className="mt-3 flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <span className="text-lg leading-none">+</span> {addLabel}
      </button>

      {hint && <p className="mt-3 text-xs text-slate-600">{hint}</p>}
    </section>
  );
}

// ─── ImportPanel ──────────────────────────────────────────────────────────────

function ImportPanel({ onDetect }: { onDetect: (s: Schema) => void }) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  const [detected, setDetected] = useState(false);

  const handleDetect = () => {
    setError('');
    setDetected(false);
    try {
      const parsed = JSON.parse(json);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      const samples = Array.isArray(parsed) ? parsed : [parsed];
      onDetect(inferSchemaFromJSON(obj, samples));
      setDetected(true);
    } catch {
      setError('Invalid JSON — paste a valid object or array.');
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import from JSON
        </span>
        <svg className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 mt-3 mb-2">
            Paste a JSON object or array — fields will be auto-detected.
          </p>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={'{\n  "title": "My Card",\n  "cards": [{ "text": "..." }]\n}'}
            rows={6}
            className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-700 outline-none focus:border-indigo-500 resize-y"
          />
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          {detected && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-900/30 border border-emerald-800/60 text-emerald-300 text-xs">
              ✓ Review detected fields below. Change any types or add dropdown options.
            </div>
          )}
          <button
            type="button"
            onClick={handleDetect}
            disabled={!json.trim()}
            className="mt-3 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            Detect Fields
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SchemaEditor page ────────────────────────────────────────────────────────

export function SchemaEditor() {
  const { id: projectId, schemaId } = useParams<{ id: string; schemaId: string }>();
  const navigate = useNavigate();

  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const addSchema = useProjectStore((s) => s.addSchema);
  const updateSchema = useProjectStore((s) => s.updateSchema);

  const isNew = schemaId === 'new';
  const existing = project?.schemas.find((s) => s.id === schemaId);

  const [schemaName, setSchemaName] = useState(existing?.name ?? '');
  const [rootFields, setRootFields] = useState<SchemaField[]>(existing?.rootFields ?? []);
  const [listFields, setListFields] = useState<SchemaField[]>(existing?.listFields ?? []);

  const isValid = schemaName.trim().length > 0 && (rootFields.length + listFields.length) > 0;

  const handleImport = useCallback((inferred: Schema) => {
    setRootFields(inferred.rootFields);
    setListFields(inferred.listFields);
    if (!schemaName) setSchemaName(inferred.name);
  }, [schemaName]);

  const handleSave = () => {
    if (!projectId || !isValid) return;
    const schema: Schema = {
      id: isNew ? uid() : (existing?.id ?? uid()),
      name: schemaName.trim(),
      rootFields,
      listFields,
    };
    if (isNew) {
      addSchema(projectId, schema);
    } else {
      updateSchema(projectId, schema.id, { name: schema.name, rootFields, listFields });
    }
    navigate(`/project/${projectId}`);
  };

  if (!project) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Project not found.{' '}
        <button onClick={() => navigate('/')} className="ml-2 text-indigo-400 hover:underline">Go home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/project/${projectId}`)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="max-w-[120px] truncate hidden sm:block">{project.name}</span>
          </button>

          <span className="text-slate-700 hidden sm:block">／</span>

          <input
            value={schemaName}
            onChange={(e) => setSchemaName(e.target.value)}
            placeholder="Schema name…"
            className="flex-1 min-w-0 bg-transparent border-b border-slate-700 focus:border-indigo-500 outline-none text-lg font-semibold text-slate-100 placeholder:text-slate-600 py-0.5 transition-colors"
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            Save Schema
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <ImportPanel onDetect={handleImport} />

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
          <FieldList
            label="Root Fields"
            addLabel="Add root field"
            fields={rootFields}
            onChange={setRootFields}
            hint="Metadata set once per content list (e.g. pack name, version)."
          />
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
          <FieldList
            label="List Fields"
            addLabel="Add list field"
            fields={listFields}
            onChange={setListFields}
            hint="Shape of each repeating item (entry) in your content list."
          />
        </div>

        {!isValid && (
          <p className="text-center text-xs text-slate-600">
            Add a schema name and at least one field to enable Save.
          </p>
        )}
      </div>
    </div>
  );
}
