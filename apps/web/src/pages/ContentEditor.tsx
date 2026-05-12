import { useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { buildJSON } from '../../../../packages/core/src/jsonBuilder';
import { inferSchemaFromJSON } from '../../../../packages/core/src/schemaInference';
import type { Entry } from '../../../../packages/core/src/types';
import { EntryForm, FieldInput } from './ContentEditorHelpers';

// ─── Flash keyframe (injected once) ──────────────────────────────────────────
const FLASH_STYLE = `@keyframes rowFlash{0%{background-color:rgba(99,102,241,0.35)}100%{background-color:transparent}}.row-flash{animation:rowFlash 900ms ease-out forwards;}`;
if (!document.getElementById('bracer-flash')) {
  const s = document.createElement('style'); s.id = 'bracer-flash'; s.textContent = FLASH_STYLE; document.head.appendChild(s);
}

// ─── Dot menu ─────────────────────────────────────────────────────────────────
function DotMenu({ onEdit, onDuplicate, onDelete }: { onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((p) => !p)}
        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors text-lg leading-none">⋮</button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {[
            { label: 'Edit', action: onEdit, cls: 'text-slate-200 hover:bg-slate-700' },
            { label: 'Duplicate', action: onDuplicate, cls: 'text-slate-200 hover:bg-slate-700' },
            { label: 'Delete', action: onDelete, cls: 'text-red-400 hover:bg-red-500/10' },
          ].map(({ label, action, cls }) => (
            <button key={label} type="button" onClick={() => { action(); setOpen(false); }}
              className={`w-full px-4 py-2 text-left text-sm transition-colors ${cls}`}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Import JSON modal ────────────────────────────────────────────────────────
function ImportModal({ schemaId, onImport, onClose }: {
  schemaId: string;
  onImport: (entries: Entry[], listFieldName: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const process = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const inferred = inferSchemaFromJSON(parsed);
      if (inferred.listFields.length === 0) { setError('No array fields found in this JSON.'); return; }
      const lf = inferred.listFields[0];
      const arr = parsed[lf.name];
      if (!Array.isArray(arr)) { setError('Expected an array under key: ' + lf.name); return; }
      onImport(arr as Entry[], lf.name);
      onClose();
    } catch {
      setError('Invalid JSON. Please check your input.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-100">Import JSON</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">×</button>
        </div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder="Paste JSON here…" rows={8}
          className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors resize-y font-mono" />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="px-4 py-2 text-sm border border-slate-700 text-slate-300 hover:border-slate-500 rounded-lg transition-colors">
            Upload file
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { setText(r.result as string); setError(null); }; r.readAsText(f); }} />
          <button type="button" onClick={() => process(text)}
            className="ml-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors">
            Import
          </button>
        </div>
        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </div>
  );
}

// ─── ContentEditor ────────────────────────────────────────────────────────────
export function ContentEditor() {
  const { id: projectId, schemaId } = useParams<{ id: string; schemaId: string }>();
  const navigate = useNavigate();

  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const addEntry = useProjectStore((s) => s.addEntry);
  const updateEntry = useProjectStore((s) => s.updateEntry);
  const deleteEntry = useProjectStore((s) => s.deleteEntry);
  const duplicateEntry = useProjectStore((s) => s.duplicateEntry);
  const updateProject = useProjectStore((s) => s.updateProject);

  // ── context: 'meta' | listFieldName
  const schema = project?.schemas.find((s) => s.id === schemaId);
  const defaultCtx = schema?.listFields[0]?.name ?? 'meta';
  const [ctx, setCtx] = useState<string>(defaultCtx);

  const [search, setSearch] = useState('');
  const [filterVal, setFilterVal] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [metaValues, setMetaValues] = useState<Record<string, unknown>>({});
  const [metaSaved, setMetaSaved] = useState(false);
  const firstRowRef = useRef<HTMLTableRowElement>(null);

  const triggerFlash = useCallback(() => {
    const id = Date.now();
    setFlashId(id);
    setTimeout(() => setFlashId(null), 900);
  }, []);

  if (!project || !schema) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Not found.{' '}
        <button onClick={() => navigate('/')} className="ml-2 text-indigo-400 hover:underline">Go home</button>
      </div>
    );
  }

  const isMeta = ctx === 'meta';
  const activeListField = schema.listFields.find((f) => f.name === ctx);
  const contentList = project.contentLists.find((cl) => cl.schemaId === schemaId && cl.listFieldName === ctx);
  const allEntries = contentList?.entries ?? [];

  // first dropdown field for filter
  const firstDropdown = activeListField?.subFields?.find((f) => f.type === 'dropdown');

  const filtered = allEntries.filter((e) => {
    const matchSearch = !search.trim() || Object.values(e).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchFilter = !filterVal || String(e[firstDropdown?.name ?? '']) === filterVal;
    return matchSearch && matchFilter;
  });

  const handleAddEntry = (entry: Entry) => {
    addEntry(projectId!, schemaId!, ctx, entry);
    triggerFlash();
  };

  const handleUpdateEntry = (entry: Entry) => {
    if (editIndex === null) return;
    updateEntry(projectId!, schemaId!, ctx, editIndex, entry);
    setEditIndex(null);
  };

  const handleImport = (entries: Entry[], _listFieldName: string) => {
    entries.forEach((e) => addEntry(projectId!, schemaId!, ctx, e));
    triggerFlash();
  };

  const handleExport = () => {
    const json = buildJSON(project, schemaId!);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${schema.name.toLowerCase().replace(/\s+/g, '-')}.json`; a.click();
  };

  const handleSaveMeta = () => {
    const rootEntry = metaValues;
    const lists = project.contentLists.filter((cl) => !(cl.schemaId === schemaId && cl.listFieldName === '__root__'));
    updateProject(projectId!, { contentLists: [...lists, { schemaId: schemaId!, listFieldName: '__root__', entries: [rootEntry] }] });
    setMetaSaved(true); setTimeout(() => setMetaSaved(false), 2000);
  };

  // Preview cols: first 3 subfields
  const previewFields = activeListField?.subFields?.slice(0, 3) ?? [];

  const ctxOptions = [
    { value: 'meta', label: 'Pack metadata' },
    ...schema.listFields.map((lf) => ({ value: lf.name, label: lf.label || lf.name })),
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* ── Topbar ── */}
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/project/${projectId}`)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors group flex-shrink-0">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline truncate max-w-[100px]">{project.name}</span>
          </button>
          <span className="text-slate-700 hidden sm:inline">／</span>
          <h1 className="font-semibold text-slate-100 truncate flex-1">{schema.name}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors">
              ↑ Import JSON
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800/60 hover:border-indigo-600 rounded-lg transition-colors">
              ↓ Export JSON
            </button>
            <button onClick={() => navigate(`/project/${projectId}/schema/${schemaId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Schema
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* ── Context switcher ── */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 flex-shrink-0">Currently editing:</span>
          <select value={ctx} onChange={(e) => { setCtx(e.target.value); setEditIndex(null); setSearch(''); setFilterVal(''); }}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-100 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
            {ctxOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* ── Top form panel ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          {isMeta ? (
            <>
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Pack Metadata</h2>
              {schema.rootFields.length === 0 && (
                <p className="text-sm text-slate-500">No root fields defined.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {schema.rootFields.map((field) => (
                  <div key={field.id} className={field.type === 'long-text' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">{field.label || field.name}</label>
                    <FieldInput field={field} value={metaValues[field.name]}
                      onChange={(v) => setMetaValues((p) => ({ ...p, [field.name]: v }))} />
                  </div>
                ))}
              </div>
              {schema.rootFields.length > 0 && (
                <button type="button" onClick={handleSaveMeta}
                  className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-indigo-900/40">
                  {metaSaved ? '✓ Saved' : 'Save Changes'}
                </button>
              )}
            </>
          ) : editIndex !== null ? (
            <>
              <h2 className="text-sm font-semibold text-indigo-400 mb-4">
                Edit Entry #{editIndex + 1}
              </h2>
              <EntryForm
                fields={activeListField?.subFields ?? []}
                initial={allEntries[editIndex] ?? {}}
                mode="edit"
                onSave={handleUpdateEntry}
                onCancel={() => setEditIndex(null)}
              />
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-300 mb-4">
                Add Entry — <span className="text-indigo-400">{activeListField?.label || ctx}</span>
              </h2>
              <EntryForm
                fields={activeListField?.subFields ?? []}
                initial={{}}
                mode="add"
                onSave={handleAddEntry}
              />
            </>
          )}
        </div>

        {/* ── Entry list ── */}
        {!isMeta && (
          <div className="flex flex-col gap-3">
            {/* List controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search entries…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors" />
              </div>
              {firstDropdown && (
                <select value={filterVal} onChange={(e) => setFilterVal(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                  <option value="">All {firstDropdown.label || firstDropdown.name}</option>
                  {(firstDropdown.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              <span className="text-xs text-slate-500 tabular-nums flex-shrink-0">
                {filtered.length}{search || filterVal ? ` / ${allEntries.length}` : ''} {allEntries.length !== 1 ? 'entries' : 'entry'}
              </span>
            </div>

            {/* Table */}
            {allEntries.length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-10">#</th>
                      {previewFields.map((f) => (
                        <th key={f.id} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{f.label || f.name}</th>
                      ))}
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry, visIdx) => {
                      const realIdx = search || filterVal ? allEntries.indexOf(entry) : visIdx;
                      const isFirst = realIdx === allEntries.length - 1 && flashId !== null;
                      return (
                        <tr key={realIdx}
                          ref={isFirst ? firstRowRef : undefined}
                          className={`border-b border-slate-800/60 last:border-0 hover:bg-slate-800/40 transition-colors group ${isFirst ? 'row-flash' : ''}`}>
                          <td className="px-4 py-2.5 text-xs text-slate-600 font-mono tabular-nums">{realIdx + 1}</td>
                          {previewFields.map((f) => (
                            <td key={f.id} className="px-4 py-2.5 text-slate-300 max-w-[200px]">
                              <span className="block truncate">
                                {Array.isArray(entry[f.name])
                                  ? (entry[f.name] as string[]).join(', ')
                                  : entry[f.name] === null || entry[f.name] === undefined
                                  ? <span className="text-slate-600 italic">—</span>
                                  : typeof entry[f.name] === 'boolean'
                                  ? entry[f.name] ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">✗</span>
                                  : String(entry[f.name])}
                              </span>
                            </td>
                          ))}
                          <td className="px-3 py-2.5">
                            <DotMenu
                              onEdit={() => { setEditIndex(realIdx); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              onDuplicate={() => duplicateEntry(projectId!, schemaId!, ctx, realIdx)}
                              onDelete={() => deleteEntry(projectId!, schemaId!, ctx, realIdx)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="py-10 text-center text-sm text-slate-500">
                    No entries match <span className="text-slate-300 font-mono">"{search || filterVal}"</span>
                    <button onClick={() => { setSearch(''); setFilterVal(''); }} className="ml-3 text-indigo-400 hover:underline">Clear</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-200 mb-1">No entries yet</h3>
                <p className="text-sm text-slate-500">Fill in the form above to add your first entry.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showImport && (
        <ImportModal schemaId={schemaId!} onImport={handleImport} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
