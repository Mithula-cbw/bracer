import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import type { SchemaField, Entry } from '../../../../packages/core/src/types';

// ─── Field input renderer ─────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SchemaField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const base =
    'w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors';

  switch (field.type) {
    case 'short-text':
      return (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label || field.name}
          className={base}
        />
      );

    case 'long-text':
      return (
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label || field.name}
          rows={3}
          className={`${base} resize-y leading-relaxed`}
        />
      );

    case 'number':
    case 'number-nullable':
      return (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
          placeholder="0"
          className={base}
        />
      );

    case 'toggle':
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative w-10 h-5 rounded-full border transition-all ${
            value
              ? 'bg-indigo-600 border-indigo-500'
              : 'bg-slate-700 border-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
              value ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      );

    case 'dropdown': {
      const opts = field.options ?? [];
      return (
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} cursor-pointer`}
        >
          <option value="">— select —</option>
          {opts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }

    case 'tags': {
      const tags = (value as string[]) ?? [];
      return <TagsInput tags={tags} onChange={onChange} />;
    }

    case 'object-optional':
    case 'list':
      // Render sub-fields recursively
      return (
        <SubObjectEditor
          fields={field.subFields ?? []}
          value={(value as Record<string, unknown>) ?? {}}
          onChange={onChange}
          isList={field.type === 'list'}
        />
      );

    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
  }
}

// ─── Tags input ───────────────────────────────────────────────────────────────

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (v: unknown) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap gap-1.5 items-center p-2 rounded-lg bg-slate-800 border border-slate-700 min-h-[40px]">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 text-xs">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}
            className="text-slate-400 hover:text-red-400 transition-colors">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        placeholder="Add tag, press Enter…"
        className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-100 placeholder:text-slate-600 outline-none"
      />
    </div>
  );
}

// ─── Sub-object editor (for object-optional & list) ──────────────────────────

function SubObjectEditor({
  fields,
  value,
  onChange,
  isList,
}: {
  fields: SchemaField[];
  value: Record<string, unknown>;
  onChange: (v: unknown) => void;
  isList: boolean;
}) {
  if (!isList) {
    return (
      <div className="ml-4 border-l-2 border-indigo-800/50 pl-4 flex flex-col gap-3 mt-1">
        {fields.map((sf) => (
          <div key={sf.id}>
            <label className="block text-xs font-medium text-slate-400 mb-1">{sf.label || sf.name}</label>
            <FieldInput
              field={sf}
              value={value[sf.name]}
              onChange={(v) => onChange({ ...value, [sf.name]: v })}
            />
          </div>
        ))}
      </div>
    );
  }

  // list type: array of sub-objects (not the main entry list — this is a nested list field)
  const items = (value as unknown as Record<string, unknown>[]) ?? [];
  return (
    <div className="ml-4 border-l-2 border-indigo-800/50 pl-4 flex flex-col gap-2 mt-1">
      {items.map((item, idx) => (
        <div key={idx} className="bg-slate-800/60 rounded-lg p-3 flex flex-col gap-2 relative group/sub">
          {fields.map((sf) => (
            <div key={sf.id}>
              <label className="block text-xs text-slate-500 mb-1">{sf.label || sf.name}</label>
              <FieldInput
                field={sf}
                value={item[sf.name]}
                onChange={(v) => {
                  const next = [...items];
                  next[idx] = { ...item, [sf.name]: v };
                  onChange(next as unknown as Record<string, unknown>);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx) as unknown as Record<string, unknown>)}
            className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const blank = Object.fromEntries(fields.map((sf) => [sf.name, '']));
          onChange([...items, blank] as unknown as Record<string, unknown>);
        }}
        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1 transition-colors"
      >
        <span>+</span> Add item
      </button>
    </div>
  );
}

// ─── Entry form (slide-over panel) ────────────────────────────────────────────

function EntryPanel({
  fields,
  initial,
  onSave,
  onClose,
  title,
}: {
  fields: SchemaField[];
  initial: Entry;
  onSave: (e: Entry) => void;
  onClose: () => void;
  title: string;
}) {
  const [values, setValues] = useState<Entry>({ ...initial });

  const set = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-slate-100">{title}</h3>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {fields.length === 0 && (
            <p className="text-sm text-slate-500 text-center mt-8">
              This schema has no list fields defined. Edit the schema first.
            </p>
          )}
          {fields.map((field) => (
            <div key={field.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-xs font-semibold text-slate-300">{field.label || field.name}</label>
                {field.required && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-400 font-bold">REQ</span>
                )}
                <span className="ml-auto text-[10px] text-slate-600 font-mono">{field.type}</span>
              </div>
              <FieldInput field={field} value={values[field.name]} onChange={(v) => set(field.name, v)} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => { onSave(values); onClose(); }}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm shadow-indigo-900/50">
            Save Entry
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ContentEditor page ───────────────────────────────────────────────────────

export function ContentEditor() {
  const { id: projectId, schemaId } = useParams<{ id: string; schemaId: string }>();
  const navigate = useNavigate();

  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const addEntry = useProjectStore((s) => s.addEntry);
  const updateEntry = useProjectStore((s) => s.updateEntry);
  const deleteEntry = useProjectStore((s) => s.deleteEntry);
  const duplicateEntry = useProjectStore((s) => s.duplicateEntry);

  const [panel, setPanel] = useState<{ mode: 'add' | 'edit'; entryIndex?: number; listFieldName: string } | null>(null);
  const [search, setSearch] = useState('');
  const [activeListField, setActiveListField] = useState<string | null>(null);

  if (!project) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Project not found.{' '}
        <button onClick={() => navigate('/')} className="ml-2 text-indigo-400 hover:underline">Go home</button>
      </div>
    );
  }

  const schema = project.schemas.find((s) => s.id === schemaId);
  if (!schema) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Schema not found.{' '}
        <button onClick={() => navigate(`/project/${projectId}`)} className="ml-2 text-indigo-400 hover:underline">Back</button>
      </div>
    );
  }

  const currentListField = activeListField ?? schema.listFields[0]?.name ?? null;

  const contentList = project.contentLists.find(
    (cl) => cl.schemaId === schemaId && cl.listFieldName === currentListField,
  );
  const entries = contentList?.entries ?? [];

  const filteredEntries = search.trim()
    ? entries.filter((e) =>
        Object.values(e).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase()),
        ),
      )
    : entries;

  const activeField = schema.listFields.find((f) => f.name === currentListField);

  const handleSaveEntry = (entry: Entry) => {
    if (!currentListField) return;
    if (panel?.mode === 'add') {
      addEntry(projectId!, schemaId!, currentListField, entry);
    } else if (panel?.mode === 'edit' && panel.entryIndex !== undefined) {
      updateEntry(projectId!, schemaId!, currentListField, panel.entryIndex, entry);
    }
  };

  const getEntryLabel = (entry: Entry, index: number): string => {
    const firstStringField = schema.listFields.find((f) => f.type === 'short-text' || f.type === 'long-text');
    if (firstStringField && entry[firstStringField.name]) {
      const v = String(entry[firstStringField.name]);
      return v.length > 48 ? v.slice(0, 48) + '…' : v;
    }
    return `Entry ${index + 1}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/project/${projectId}`)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors group flex-shrink-0">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline truncate max-w-[100px]">{project.name}</span>
          </button>
          <span className="text-slate-700 hidden sm:inline">／</span>
          <h1 className="font-semibold text-slate-100 truncate flex-1">{schema.name}</h1>
          <button
            onClick={() => navigate(`/project/${projectId}/schema/${schemaId}`)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Schema
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* List field tabs */}
        {schema.listFields.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {schema.listFields.map((lf) => {
              const count = project.contentLists.find(
                (cl) => cl.schemaId === schemaId && cl.listFieldName === lf.name,
              )?.entries.length ?? 0;
              return (
                <button
                  key={lf.id}
                  onClick={() => setActiveListField(lf.name)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    currentListField === lf.name
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {lf.name}
                  <span className="ml-1.5 text-[10px] opacity-70 tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entries…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
            <span className="font-mono tabular-nums">
              {filteredEntries.length}{search ? ` / ${entries.length}` : ''} entr{entries.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>

          <button
            onClick={() => currentListField && setPanel({ mode: 'add', listFieldName: currentListField })}
            disabled={!currentListField}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-sm shadow-indigo-900/40 flex-shrink-0"
          >
            <span className="text-base leading-none">+</span> Add Entry
          </button>
        </div>

        {/* No list fields */}
        {schema.listFields.length === 0 && (
          <div className="mt-16 flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-200 mb-1">No list fields</h3>
            <p className="text-sm text-slate-500 mb-4">Define list fields in the schema to add entries.</p>
            <button onClick={() => navigate(`/project/${projectId}/schema/${schemaId}`)}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
              Edit Schema
            </button>
          </div>
        )}

        {/* Empty entries */}
        {schema.listFields.length > 0 && entries.length === 0 && (
          <div className="mt-12 flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-200 mb-1">No entries yet</h3>
            <p className="text-sm text-slate-500 mb-4">Add your first entry to start filling this content list.</p>
            <button
              onClick={() => currentListField && setPanel({ mode: 'add', listFieldName: currentListField })}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
              Add first entry
            </button>
          </div>
        )}

        {/* Entry grid */}
        {filteredEntries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredEntries.map((entry, visIdx) => {
              // Map back to real index for store operations
              const realIdx = search.trim() ? entries.indexOf(entry) : visIdx;
              const label = getEntryLabel(entry, realIdx);

              // Preview: first 3 non-empty fields
              const preview = schema.listFields
                .map((f) => ({ name: f.name, value: entry[f.name] }))
                .filter(({ value }) => value !== undefined && value !== '' && value !== null)
                .slice(0, 3);

              return (
                <div key={realIdx}
                  className="group bg-slate-900 border border-slate-800 hover:border-indigo-700/50 rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all hover:shadow-lg hover:shadow-indigo-900/10"
                  onClick={() => setPanel({ mode: 'edit', entryIndex: realIdx, listFieldName: currentListField! })}>

                  {/* Label + index */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100 leading-snug line-clamp-2 flex-1">{label}</p>
                    <span className="flex-shrink-0 text-xs font-mono text-slate-600 tabular-nums">#{realIdx + 1}</span>
                  </div>

                  {/* Field previews */}
                  {preview.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {preview.map(({ name, value }) => (
                        <div key={name} className="flex items-baseline gap-1.5 text-xs">
                          <span className="text-slate-600 font-mono flex-shrink-0">{name}</span>
                          <span className="text-slate-400 truncate">
                            {Array.isArray(value)
                              ? `[${(value as string[]).join(', ')}]`
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto pt-2 border-t border-slate-800 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); duplicateEntry(projectId!, schemaId!, currentListField!, realIdx); }}
                      className="flex-1 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
                      title="Duplicate">
                      Duplicate
                    </button>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); deleteEntry(projectId!, schemaId!, currentListField!, realIdx); }}
                      className="flex-1 py-1 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Delete">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No results from search */}
        {search.trim() && filteredEntries.length === 0 && entries.length > 0 && (
          <div className="mt-12 text-center text-sm text-slate-500">
            No entries match <span className="text-slate-300 font-mono">"{search}"</span>
            <button onClick={() => setSearch('')} className="ml-3 text-indigo-400 hover:underline">Clear</button>
          </div>
        )}
      </div>

      {/* Entry panel */}
      {panel && activeField && (
        <EntryPanel
          fields={schema.listFields}
          initial={
            panel.mode === 'edit' && panel.entryIndex !== undefined
              ? entries[panel.entryIndex] ?? {}
              : {}
          }
          onSave={handleSaveEntry}
          onClose={() => setPanel(null)}
          title={panel.mode === 'add' ? 'New Entry' : `Edit Entry #${(panel.entryIndex ?? 0) + 1}`}
        />
      )}
    </div>
  );
}
