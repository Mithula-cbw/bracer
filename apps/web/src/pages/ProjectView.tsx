import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { Badge, Button } from '../components/ui';
import type { Schema } from '../../../../packages/core/src/types';
import { buildJSON } from '../../../../packages/core/src/jsonBuilder';

export function ProjectView() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const allProjects = useProjectStore((s) => s.projects);
  const addSchema = useProjectStore((s) => s.addSchema);
  const updateSchema = useProjectStore((s) => s.updateSchema);
  const deleteSchema = useProjectStore((s) => s.deleteSchema);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const copySchemaStore = useProjectStore((s) => s.copySchema);

  const [contextSchema, setContextSchema] = useState<{ x: number; y: number; schemaId: string } | null>(null);

  // rename schema modal state
  const [renameSchemaId, setRenameSchemaId] = useState<string | null>(null);
  const [renameSchemaName, setRenameSchemaName] = useState('');
  const [renameSchemaError, setRenameSchemaError] = useState('');

  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');

  const [copyFromSource, setCopyFromSource] = useState('');
  const [copyNewSchemaName, setCopyNewSchemaName] = useState('');

  useEffect(() => {
    if (project && !isEditingProjectName) {
      setProjectNameInput(project.name);
    }
  }, [project, isEditingProjectName]);

  if (!project) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Project not found.{' '}
        <button onClick={() => navigate('/')} className="ml-2 text-indigo-400 hover:underline">Go home</button>
      </div>
    );
  }

  const totalEntries = project.contentLists.reduce((a, cl) => a + cl.entries.length, 0);

  const handleNewSchema = () => {
    navigate(`/project/${projectId}/schema/new`);
  };

  const handleContextMenu = (e: React.MouseEvent, schemaId: string) => {
    e.preventDefault();
    setContextSchema({ x: e.clientX, y: e.clientY, schemaId });
  };

  const syncConfig: Record<typeof project.syncStatus, { variant: any; label: string }> = {
    synced:   { variant: 'success', label: 'Synced' },
    syncing:  { variant: 'accent',  label: 'Syncing…' },
    conflict: { variant: 'warning', label: 'Conflict' },
    local:    { variant: 'default', label: 'Local Only' },
    error:    { variant: 'error',   label: 'Sync Error' },
  };
  const sync = syncConfig[project.syncStatus];

  const thisProjectSchemas = project.schemas;
  const otherProjects = allProjects.filter((p) => p.id !== project.id && p.schemas.length > 0);

  const handleCreateCopy = () => {
    if (!copyFromSource || !copyNewSchemaName.trim()) return;
    const [sourceProjectId, sourceSchemaId] = copyFromSource.split('|');
    updateProject(project.id, { lastModified: new Date().toISOString() });
    copySchemaStore(sourceProjectId, sourceSchemaId, project.id, copyNewSchemaName.trim());
    setCopyFromSource('');
    setCopyNewSchemaName('');
  };

  const handleRenameSchema = () => {
    const trimmed = renameSchemaName.trim();
    if (!renameSchemaId || !trimmed || !project) return;
    
    if (project.schemas.some(s => s.id !== renameSchemaId && s.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setRenameSchemaError('A schema with this name already exists.');
      return;
    }

    updateSchema(project.id, renameSchemaId, { name: trimmed });
    setRenameSchemaId(null);
    setRenameSchemaName('');
    setRenameSchemaError('');
  };

  const openRenameSchema = (schemaId: string) => {
    const schema = project?.schemas.find((s) => s.id === schemaId);
    if (!schema) return;
    setRenameSchemaId(schemaId);
    setRenameSchemaName(schema.name);
    setRenameSchemaError('');
    setContextSchema(null);
  };

  const handleDownloadJSON = () => {
    const result: any = {
      project: project.name,
      schemas: {}
    };
    project.schemas.forEach(schema => {
      result.schemas[schema.name] = buildJSON(project, schema.id);
    });
    
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 font-sans"
      onClick={() => setContextSchema(null)}
    >
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Projects</span>
          </button>

          <span className="text-slate-700 hidden sm:inline">／</span>

          {isEditingProjectName ? (
            <input 
              autoFocus
              className="bg-slate-900 border border-indigo-500 text-slate-100 rounded px-2 py-0.5 text-base font-semibold outline-none focus:ring-1 focus:ring-indigo-500 flex-1"
              value={projectNameInput}
              onChange={e => setProjectNameInput(e.target.value)}
              onBlur={() => {
                setIsEditingProjectName(false);
                if (projectNameInput.trim() && projectNameInput !== project.name) {
                  updateProject(project.id, { name: projectNameInput.trim() });
                } else {
                  setProjectNameInput(project.name);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setProjectNameInput(project.name);
                  setIsEditingProjectName(false);
                }
              }}
            />
          ) : (
            <h1 
              className="font-semibold text-lg text-slate-100 flex-1 truncate hover:text-indigo-400 cursor-pointer transition-colors"
              onClick={() => {
                setProjectNameInput(project.name);
                setIsEditingProjectName(true);
              }}
              title="Click to rename project"
            >
              {project.name}
            </h1>
          )}

          <Badge variant="default">v{project.version}</Badge>
          <Badge variant={sync.variant} dot>{sync.label}</Badge>

          <button
            onClick={handleNewSchema}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">New Schema</span>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Project meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Schemas',  value: project.schemas.length },
            { label: 'Entries',  value: totalEntries },
            { label: 'Version',  value: `v${project.version}` },
            { label: 'Modified', value: new Date(project.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-slate-500 text-xs uppercase tracking-wider mb-1 font-medium">{label}</div>
              <div className="font-mono text-xl font-semibold text-slate-100">{value}</div>
            </div>
          ))}
        </div>

        {/* Schemas Header & Actions */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Schemas</h2>
          
          <div className="flex flex-wrap items-center gap-3">
            {!copyFromSource ? (
              <select 
                value={copyFromSource} 
                onChange={e => setCopyFromSource(e.target.value)}
                className="bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              >
                <option value="">Copy schema from ▾</option>
                {thisProjectSchemas.length > 0 && (
                  <optgroup label="This project">
                    {thisProjectSchemas.map(s => <option key={s.id} value={`${project.id}|${s.id}`}>{s.name}</option>)}
                  </optgroup>
                )}
                {otherProjects.length > 0 && (
                  <optgroup label="Other projects">
                    {otherProjects.map(p => 
                      p.schemas.map(s => <option key={`${p.id}|${s.id}`} value={`${p.id}|${s.id}`}>{p.name} - {s.name}</option>)
                    )}
                  </optgroup>
                )}
              </select>
            ) : (
              <div className="flex items-center gap-2 bg-slate-900 border border-indigo-500/50 rounded-lg p-1 pl-3">
                <span className="text-xs text-slate-400 whitespace-nowrap">New name:</span>
                <input 
                  autoFocus
                  className="bg-transparent border-none text-sm text-slate-100 focus:outline-none focus:ring-0 w-32" 
                  value={copyNewSchemaName}
                  onChange={e => setCopyNewSchemaName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateCopy();
                    if (e.key === 'Escape') setCopyFromSource('');
                  }}
                  placeholder="e.g. users-copy"
                />
                <button 
                  onClick={handleCreateCopy} 
                  disabled={!copyNewSchemaName.trim()}
                  className="px-2 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded transition-colors"
                >
                  Copy
                </button>
                <button 
                  onClick={() => { setCopyFromSource(''); setCopyNewSchemaName(''); }} 
                  className="text-slate-500 hover:text-slate-300 px-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-lg transition-colors"
              title="Export entire project"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Download JSON</span>
            </button>
          </div>
        </div>

        {project.schemas.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-20 h-20 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-1">No schemas yet</h3>
            <p className="text-slate-500 text-sm mb-5">Define a schema to start structuring your content.</p>
            <button
              onClick={handleNewSchema}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Create first schema
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.schemas.map((schema: Schema) => {
              const list = project.contentLists.find(
                (cl) => cl.schemaId === schema.id
              );
              const entryCount = list?.entries.length ?? 0;
              const fieldCount = schema.rootFields.length + schema.listFields.length;

              return (
                <div
                  key={schema.id}
                  className="group bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl p-4 cursor-pointer transition-colors relative"
                  onClick={() => navigate(`/project/${projectId}/content/${schema.id}`)}
                  onContextMenu={(e) => handleContextMenu(e, schema.id)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-900/50 border border-indigo-800/60 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                      </svg>
                    </div>
                    <button
                      className="p-1.5 rounded-md hover:bg-slate-800 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleContextMenu(e, schema.id); }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>

                  <h3 className="font-semibold text-slate-100 mb-3 truncate">{schema.name}</h3>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-950/50 rounded-lg py-2">
                      <div className="font-mono font-semibold text-slate-200">{fieldCount}</div>
                      <div className="text-xs text-slate-600 mt-0.5">fields</div>
                    </div>
                    <div className="bg-slate-950/50 rounded-lg py-2">
                      <div className="font-mono font-semibold text-slate-200">{entryCount}</div>
                      <div className="text-xs text-slate-600 mt-0.5">entries</div>
                    </div>
                  </div>

                  {/* Configure schema link */}
                  <button
                    className="mt-3 w-full py-1.5 text-xs text-slate-400 hover:text-slate-300 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/50 rounded-lg transition-all"
                    onClick={(e) => { e.stopPropagation(); navigate(`/project/${projectId}/schema/${schema.id}`); }}
                  >
                    Configure Schema →
                  </button>
                </div>
              );
            })}

            {/* Add New Schema Card */}
            <div
              className="group flex flex-col items-center justify-center bg-slate-900/20 border border-slate-800/60 hover:border-indigo-500/50 hover:bg-indigo-950/20 rounded-xl p-4 cursor-pointer transition-all border-dashed text-slate-500 hover:text-indigo-400 min-h-[180px]"
              onClick={handleNewSchema}
            >
              <div className="w-10 h-10 rounded-full bg-slate-800/40 group-hover:bg-indigo-500/20 flex items-center justify-center mb-3 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="text-sm font-medium">New Schema</span>
            </div>
          </div>
        )}
      </div>

      {/* Rename Schema Modal */}
      {renameSchemaId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 p-6 rounded-xl w-full max-w-md shadow-2xl border border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-slate-100">Rename Schema</h2>
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-400 mb-1">Schema Name</label>
              <input
                type="text"
                className={`w-full px-3 py-2 text-sm rounded-md bg-slate-950 text-slate-100 border focus:ring-1 outline-none transition-all ${
                  renameSchemaError 
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500' 
                    : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
                value={renameSchemaName}
                onChange={(e) => {
                  setRenameSchemaName(e.target.value);
                  setRenameSchemaError('');
                }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSchema(); }}
              />
              {renameSchemaError && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {renameSchemaError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setRenameSchemaId(null); setRenameSchemaError(''); }} className="text-slate-300 hover:bg-slate-800 hover:text-slate-100">Cancel</Button>
              <Button onClick={handleRenameSchema} className="bg-indigo-600 hover:bg-indigo-500 text-white border-0">Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextSchema && (
        <div
          className="fixed z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ top: contextSchema.y, left: contextSchema.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
            onClick={() => { navigate(`/project/${projectId}/schema/${contextSchema.schemaId}`); setContextSchema(null); }}
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Edit Schema
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2 border-b border-slate-700/50 mb-1 pb-1"
            onClick={() => openRenameSchema(contextSchema.schemaId)}
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Rename Schema
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
            onClick={() => { navigate(`/project/${projectId}/content/${contextSchema.schemaId}`); setContextSchema(null); }}
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
            Edit Content
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 border-t border-slate-700/50 mt-1 pt-1"
            onClick={() => { deleteSchema(projectId!, contextSchema.schemaId); setContextSchema(null); }}
          >
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete Schema
          </button>
        </div>
      )}
    </div>
  );
}
