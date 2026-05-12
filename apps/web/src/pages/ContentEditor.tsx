import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { buildJSON } from '../../../../packages/core/src/jsonBuilder';
import { inferSchemaFromJSON } from '../../../../packages/core/src/schemaInference';
import type { Entry } from '../../../../packages/core/src/types';
import { EntryForm, FieldInput } from './ContentEditorHelpers';

// ── Flash style ───────────────────────────────────────────────────────────────
const FLASH_CSS = `
@keyframes flashEntry{0%{background-color:rgba(99,102,241,0.0)}40%{background-color:rgba(99,102,241,0.22)}100%{background-color:transparent}}
.row-flash{animation:flashEntry 900ms ease-out forwards;}
`;
if (!document.getElementById('bracer-flash')) {
  const s = document.createElement('style');
  s.id = 'bracer-flash';
  s.textContent = FLASH_CSS;
  document.head.appendChild(s);
}

// ── DotMenu (portal, fixed coords so never clipped) ─────────────────────────
function DotMenu({ onEdit, onDuplicate, onDelete }: {
  onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest('[data-dotmenu]')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuH = 120;
      const top = r.bottom + menuH > window.innerHeight ? r.top - menuH : r.bottom + 4;
      setPos({ top, left: r.right - 160 });
    }
    setOpen((p) => !p);
  };

  const items = [
    { label: 'Edit', action: onEdit, cls: 'text-slate-200 hover:bg-slate-700' },
    { label: 'Duplicate', action: onDuplicate, cls: 'text-slate-200 hover:bg-slate-700' },
    { label: 'Delete', action: onDelete, cls: 'text-red-400 hover:bg-red-500/10' },
  ];

  return (
    <div data-dotmenu>
      <button ref={btnRef} type="button" onClick={toggle}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors text-xl leading-none">
        ⋮
      </button>
      {open && typeof document !== 'undefined' && (
        <div data-dotmenu
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 160 }}
          className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}>
          {items.map(({ label, action, cls }) => (
            <button key={label} type="button"
              onClick={() => { action(); setOpen(false); }}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${cls}`}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ImportPanel ────────────────────────────────────────────────────────────────
function ImportPanel({ onImport, onClose }: {
  onImport: (entries: Entry[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const process = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const inferred = inferSchemaFromJSON(parsed);
      if (inferred.listFields.length === 0) {
        setStatus({ type: 'error', msg: 'No array fields found in this JSON.' });
        return;
      }
      const lf = inferred.listFields[0];
      const arr = parsed[lf.name];
      if (!Array.isArray(arr)) { setStatus({ type: 'error', msg: `Expected array at key "${lf.name}".` }); return; }
      onImport(arr as Entry[]);
      setStatus({ type: 'success', msg: `Imported ${arr.length} entries.` });
      setText('');
    } catch {
      setStatus({ type: 'error', msg: 'Invalid JSON — check your input.' });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">↑ Import JSON</h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Hide</button>
      </div>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setStatus(null); }}
        placeholder={'{\n  "cards": [...]\n}'}
        rows={6}
        className="w-full px-4 py-3 text-sm font-mono rounded-xl bg-slate-950 border border-slate-800 text-slate-300 placeholder:text-slate-700 outline-none focus:border-indigo-500 transition-colors resize-y"
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="px-4 py-2 text-sm border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 rounded-xl transition-colors">
          Upload .json
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => { setText(r.result as string); setStatus(null); };
            r.readAsText(f);
            e.target.value = '';
          }}
        />
        <button type="button" onClick={() => process(text)} disabled={!text.trim()}
          className="ml-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
          Import
        </button>
      </div>
      {status && (
        <div className={`text-sm px-4 py-2.5 rounded-xl border ${
          status.type === 'success'
            ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-400'
            : 'bg-red-900/30 border-red-700/40 text-red-400'
        }`}>
          {status.type === 'success' ? '✓ ' : '✗ '}{status.msg}
        </div>
      )}
    </div>
  );
}

// ── ContentEditor ─────────────────────────────────────────────────────────────
export function ContentEditor() {
  const { id: projectId, schemaId } = useParams<{ id: string; schemaId: string }>();
  const navigate = useNavigate();

  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const addEntry = useProjectStore((s) => s.addEntry);
  const updateEntry = useProjectStore((s) => s.updateEntry);
  const deleteEntry = useProjectStore((s) => s.deleteEntry);
  const duplicateEntry = useProjectStore((s) => s.duplicateEntry);
  const updateProject = useProjectStore((s) => s.updateProject);

  const schema = project?.schemas.find((s) => s.id === schemaId);
  const defaultCtx = schema?.listFields[0]?.name ?? 'meta';

  const [ctx, setCtx] = useState<string>(defaultCtx);
  const [search, setSearch] = useState('');
  const [filterVal, setFilterVal] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [metaValues, setMetaValues] = useState<Record<string, unknown>>({});
  const [metaSaved, setMetaSaved] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const isMeta = ctx === 'meta';
  const activeListField = schema?.listFields.find((f) => f.name === ctx);

  const contentList = project?.contentLists.find(
    (cl) => cl.schemaId === schemaId && cl.listFieldName === ctx,
  );
  const allEntries = contentList?.entries ?? [];

  // Reversed for latest-first display
  const reversedEntries = [...allEntries].reverse();
  const firstDropdown = activeListField?.subFields?.find((f) => f.type === 'dropdown');

  const filtered = reversedEntries.filter((e) => {
    const matchSearch = !search.trim() ||
      Object.values(e).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchFilter = !filterVal ||
      String(e[firstDropdown?.name ?? '']) === filterVal;
    return matchSearch && matchFilter;
  });

  const visibleEntries = (search || filterVal || showAll) ? filtered : filtered.slice(0, 5);

  // Load saved meta on mount
  useEffect(() => {
    const rootEntry = project?.contentLists.find(
      (cl) => cl.schemaId === schemaId && cl.listFieldName === '__root__',
    )?.entries[0];
    if (rootEntry) setMetaValues(rootEntry);
  }, [schemaId]);

  const triggerFlash = useCallback((idx: number) => {
    setFlashIdx(idx);
    setTimeout(() => setFlashIdx(null), 900);
  }, []);

  if (!project || !schema) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Not found.{' '}
        <button onClick={() => navigate('/')} className="ml-2 text-indigo-400 hover:underline">Go home</button>
      </div>
    );
  }

  const handleAddEntry = (entry: Entry) => {
    addEntry(projectId!, schemaId!, ctx, entry);
    const newIdx = allEntries.length; // will be the new last index
    triggerFlash(newIdx);
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const handleUpdateEntry = (entry: Entry) => {
    if (editIndex === null) return;
    updateEntry(projectId!, schemaId!, ctx, editIndex, entry);
    setEditIndex(null);
    triggerFlash(editIndex);
  };

  const handleImport = (entries: Entry[]) => {
    entries.forEach((e) => addEntry(projectId!, schemaId!, ctx, e));
    triggerFlash(allEntries.length + entries.length - 1);
  };

  const handleExport = () => {
    const json = buildJSON(project, schemaId!);
    const jsonStr = JSON.stringify(json, null, 2).replace(/"__FLOAT__(.*?)__FLOAT__"/g, '$1');
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${schema.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
  };

  const handleSaveMeta = () => {
    const existing = project.contentLists.filter(
      (cl) => !(cl.schemaId === schemaId && cl.listFieldName === '__root__'),
    );
    updateProject(projectId!, {
      contentLists: [...existing, { schemaId: schemaId!, listFieldName: '__root__', entries: [metaValues] }],
    });
    setMetaSaved(true);
    setTimeout(() => setMetaSaved(false), 2000);
  };

  const ctxOptions = [
    { value: 'meta', label: 'Pack metadata' },
    ...schema.listFields.map((lf) => ({ value: lf.name, label: lf.label || lf.name })),
  ];

  const previewFields = activeListField?.subFields?.slice(0, 3) ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 sm:pb-10">
      {/* ── Topbar ── */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/project/${projectId}`)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors group flex-shrink-0">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline truncate max-w-[120px] text-slate-500">{project.name}</span>
          </button>
          <span className="text-slate-700 hidden sm:inline text-xs">／</span>
          <h1 className="font-bold text-slate-100 truncate flex-1 text-base">{schema.name}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowImport((p) => !p)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors">
              ↑ Import
            </button>
            <button onClick={handleExport}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800/60 hover:border-indigo-600 rounded-lg transition-colors">
              ↓ Export JSON
            </button>
            <button onClick={() => navigate(`/project/${projectId}/schema/${schemaId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="hidden sm:inline">Schema</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* ── Context switcher ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-600 uppercase tracking-widest font-semibold">Editing:</span>
          <select value={ctx}
            onChange={(e) => { setCtx(e.target.value); setEditIndex(null); setSearch(''); setFilterVal(''); }}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 border border-slate-700 text-slate-100 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
            {ctxOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {!isMeta && (
            <span className="text-xs text-slate-600 tabular-nums">
              {allEntries.length} {allEntries.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>

        {/* ── Top form panel ── */}
        <div className="bg-slate-900 border border-t-indigo-500/60 border-slate-800 rounded-2xl p-5 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 mb-3">
            {isMeta ? 'Pack Metadata' : editIndex !== null ? `Edit Entry #${editIndex + 1}` : 'Add Entry'}
          </p>

          {isMeta ? (
            <>
              {schema.rootFields.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No root fields defined in this schema.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {schema.rootFields.map((field) => (
                    <div key={field.id} className={field.type === 'long-text' || field.type === 'tags' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
                        {field.label || field.name}
                      </label>
                      <FieldInput field={field} value={metaValues[field.name]}
                        onChange={(v) => setMetaValues((p) => ({ ...p, [field.name]: v }))} />
                    </div>
                  ))}
                </div>
              )}
              {schema.rootFields.length > 0 && (
                <button type="button" onClick={handleSaveMeta}
                  className="mt-5 sm:w-auto w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-900/40">
                  {metaSaved ? '✓ Saved!' : 'Save Changes'}
                </button>
              )}
            </>
          ) : (
            <EntryForm
              key={editIndex ?? 'add'}
              fields={activeListField?.subFields ?? []}
              initial={editIndex !== null ? (allEntries[editIndex] ?? {}) : {}}
              mode={editIndex !== null ? 'edit' : 'add'}
              onSave={editIndex !== null ? handleUpdateEntry : handleAddEntry}
              onCancel={editIndex !== null ? () => setEditIndex(null) : undefined}
            />
          )}
        </div>

        {/* ── Import ── */}
        {showImport && (
          <ImportPanel onImport={handleImport} onClose={() => setShowImport(false)} />
        )}

        {/* ── Entry list ── */}
        {!isMeta && (
          <div className="flex flex-col gap-3" ref={listRef}>
            {/* Sticky search + filter bar */}
            <div className="sticky top-[57px] z-20 bg-slate-950/95 backdrop-blur-md pb-2 -mx-4 px-4 pt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[160px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search entries…"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors" />
                </div>
                {firstDropdown && (firstDropdown.options ?? []).length > 0 && (
                  <select value={filterVal} onChange={(e) => setFilterVal(e.target.value)}
                    className="px-3 py-2 text-sm rounded-xl bg-slate-900 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                    <option value="">All {firstDropdown.label || firstDropdown.name}</option>
                    {(firstDropdown.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                {(search || filterVal) && (
                  <button onClick={() => { setSearch(''); setFilterVal(''); }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
                )}
              </div>
            </div>

            {/* Table */}
            {allEntries.length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {previewFields.length > 0 && (
                  <div className="grid border-b border-slate-800/80"
                    style={{ gridTemplateColumns: `48px repeat(${previewFields.length}, 1fr) 48px` }}>
                    <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">#</div>
                    {previewFields.map((f) => (
                      <div key={f.id} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        {f.label || f.name}
                      </div>
                    ))}
                    <div />
                  </div>
                )}

                {filtered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    No entries match{' '}
                    <span className="text-slate-300 font-mono">"{search || filterVal}"</span>
                  </div>
                ) : (
                  visibleEntries.map((entry, visIdx) => {
                    const realIdx = allEntries.indexOf(entry);
                    const isFlashing = realIdx === flashIdx;
                    return (
                      <div
                        key={realIdx}
                        className={`group grid border-b border-slate-800/50 last:border-0 transition-colors hover:bg-slate-800/30 ${isFlashing ? 'row-flash' : ''} ${visIdx % 2 === 1 ? 'bg-slate-900/40' : ''}`}
                        style={{ gridTemplateColumns: previewFields.length > 0 ? `48px repeat(${previewFields.length}, 1fr) 48px` : '1fr 48px' }}
                      >
                        <div className="px-4 py-3 text-xs text-slate-600 font-mono tabular-nums self-center">{realIdx + 1}</div>
                        {previewFields.map((f, fi) => (
                          <div key={f.id} className="px-4 py-3 self-center min-w-0">
                            <span className={`block truncate text-sm ${fi === 0 ? 'font-semibold text-slate-100' : 'text-slate-400'}`}>
                              {Array.isArray(entry[f.name])
                                ? (entry[f.name] as string[]).join(', ') || <span className="text-slate-600 italic">—</span>
                                : entry[f.name] === null || entry[f.name] === undefined || entry[f.name] === ''
                                ? <span className="text-slate-600 italic">—</span>
                                : typeof entry[f.name] === 'boolean'
                                ? (entry[f.name]
                                  ? <span className="text-emerald-400 font-medium">✓ Yes</span>
                                  : <span className="text-slate-600">✗ No</span>)
                                : String(entry[f.name])}
                            </span>
                          </div>
                        ))}
                        <div className="px-2 py-2 self-center flex justify-center">
                          <DotMenu
                            onEdit={() => {
                              setEditIndex(realIdx);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            onDuplicate={() => duplicateEntry(projectId!, schemaId!, ctx, realIdx)}
                            onDelete={() => deleteEntry(projectId!, schemaId!, ctx, realIdx)}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
                {!showAll && !search && !filterVal && filtered.length > 5 && (
                  <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/40">
                    <span className="text-xs text-slate-500 font-medium">{filtered.length - 5} more entries hidden</span>
                    <button type="button" onClick={() => setShowAll(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                      View all {filtered.length} entries ↓
                    </button>
                  </div>
                )}
                {showAll && !search && !filterVal && filtered.length > 5 && (
                  <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-center bg-slate-900/40">
                    <button type="button" onClick={() => setShowAll(false)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium">
                      Show less ↑
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-4 border border-slate-700/50">
                  <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-slate-400 font-medium mb-1">No entries yet.</p>
                <p className="text-sm text-slate-600">Add your first one above.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile floating bottom bar ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 flex gap-3">
        <button onClick={() => setShowImport((p) => !p)}
          className="flex-1 py-2.5 text-sm font-medium text-slate-300 border border-slate-700 rounded-xl transition-colors hover:border-slate-600">
          ↑ Import
        </button>
        <button onClick={handleExport}
          className="flex-1 py-2.5 text-sm font-semibold text-indigo-300 border border-indigo-800/60 rounded-xl transition-colors hover:border-indigo-600">
          ↓ Export JSON
        </button>
      </div>
    </div>
  );
}
