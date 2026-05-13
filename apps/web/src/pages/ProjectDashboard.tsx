import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge } from '../components/ui';
import { useProjectStore } from '../store/projectStore';
import type { Project } from '../../../../packages/core/src/types';

const syncStatusConfig: Record<Project['syncStatus'], { variant: any; label: string }> = {
  synced: { variant: 'success', label: 'Synced' },
  syncing: { variant: 'accent', label: 'Syncing...' },
  conflict: { variant: 'warning', label: 'Conflict' },
  local: { variant: 'default', label: 'Local Only' },
  error: { variant: 'error', label: 'Sync Error' },
};

export function ProjectDashboard() {
  const navigate = useNavigate();

  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const updateProject = useProjectStore((s) => s.updateProject);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectError, setNewProjectError] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; projectId: string } | null>(null);

  // rename modal state
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const [showBanner, setShowBanner] = useState(() => {
    return localStorage.getItem('bracer_hide_desktop_banner') !== 'true';
  });

  const dismissBanner = () => {
    localStorage.setItem('bracer_hide_desktop_banner', 'true');
    setShowBanner(false);
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, projectId });
  };

  const handleCreateProject = () => {
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    if (projects.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setNewProjectError('A project with this name already exists.');
      return;
    }
    createProject(trimmed);
    setShowNewModal(false);
    setNewProjectName('');
    setNewProjectError('');
  };

  const handleRename = () => {
    const trimmed = renameName.trim();
    if (!renameId || !trimmed) return;
    if (projects.some((p) => p.id !== renameId && p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setRenameError('A project with this name already exists.');
      return;
    }
    updateProject(renameId, { name: trimmed });
    setRenameId(null);
    setRenameName('');
    setRenameError('');
  };

  const openRename = (projectId: string) => {
    const p = projects.find((p) => p.id === projectId);
    if (!p) return;
    setRenameId(projectId);
    setRenameName(p.name);
    setRenameError('');
    setContextMenu(null);
  };

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden bg-slate-950 font-sans text-slate-100">

      {/* Sidebar / Topbar on Mobile */}
      <div className="w-full md:w-[260px] md:min-w-[260px] bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-4 flex flex-row md:flex-col items-center md:items-stretch justify-between md:justify-start gap-4 z-10 shrink-0">
        <div className="flex items-center gap-2 mb-0 md:mb-4 px-1 md:px-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            B
          </div>
          <h1 className="font-bold text-xl text-slate-100 tracking-tight hidden sm:block md:block">Bracer</h1>
        </div>

        <div className="flex items-center gap-3 ml-auto md:ml-0 md:flex-col md:flex-1 w-full">
          <button
            onClick={() => setShowNewModal(true)}
            className="hidden md:flex items-center justify-center gap-2 w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md cursor-pointer text-sm font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            <span>New Project</span>
          </button>

          <div className="md:mt-auto w-full flex flex-col gap-4">
            <div className="md:border-t md:border-slate-800 md:pt-4">
              {isAuthed ? (
                <div className="flex items-center gap-3 cursor-pointer group px-1 md:px-2" onClick={() => setIsAuthed(false)}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:ring-2 ring-teal-500 ring-offset-2 ring-offset-slate-900 transition-all">
                    M
                  </div>
                  <div className="text-sm font-medium text-slate-400 group-hover:text-slate-100 transition-colors hidden md:block">
                    Connected to Drive
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAuthed(true)} 
                  className="flex items-center justify-center md:justify-start gap-3 w-auto md:w-full px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer text-sm font-medium transition-colors border border-slate-700 shadow-sm"
                >
                  <div className="bg-white p-1 rounded flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  <span className="hidden md:inline">Connect Google Drive</span>
                </button>
              )}
            </div>

            <div className="hidden md:flex flex-col gap-2 px-2 text-xs text-slate-500 pb-2">
              <div className="flex items-center gap-2">
                <span>Created by Mithula Chanthuka</span>
              </div>
              <div className="flex items-center gap-2">
                <a href="https://github.com/Mithula-cbw/bracer" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition-colors flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                  Contribute
                </a>
                <span>•</span>
                <span className="hover:text-slate-300 transition-colors cursor-pointer">MIT License</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-slate-950 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          {/* Desktop App Banner */}
          {showBanner && (
            <div className="mb-8 relative overflow-hidden bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
              <button 
                onClick={dismissBanner}
                className="absolute top-3 right-3 z-20 text-indigo-300 hover:text-white transition-colors p-1"
                aria-label="Dismiss banner"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10 flex-1 pr-4 sm:pr-0">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">Use Bracer a lot?</h3>
                <p className="text-indigo-200/80 text-sm sm:text-base max-w-lg">
                  Download our dedicated desktop application for a native experience. Available for Windows and Linux.
                </p>
              </div>
              
              <div className="relative z-10 shrink-0 mt-2 sm:mt-0">
                {/* TODO: Add link when releases are available */}
                <button 
                  onClick={() => {}} 
                  className="px-5 py-2.5 bg-white text-indigo-950 hover:bg-indigo-50 font-semibold rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Desktop App
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-6 gap-4">
            <h2 className="text-2xl font-bold text-slate-100">Projects</h2>
            
            {projects.length > 0 && (
              <div className="relative group flex items-center justify-end flex-shrink-0">
                <svg className={`w-4 h-4 text-slate-500 absolute pointer-events-none group-focus-within:text-indigo-400 transition-all z-10 ${
                  searchQuery ? 'left-[10px] sm:left-3' : 'left-[10px] sm:left-3'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text"
                  placeholder="Search projects..."
                  className={`bg-slate-900 border border-slate-800 hover:border-slate-700 text-sm rounded-full py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm cursor-pointer focus:cursor-text h-[36px] focus:w-[160px] sm:focus:w-[220px] md:focus:w-[260px] focus:pr-8 focus:text-slate-100 focus:placeholder:text-slate-500 ${
                    searchQuery 
                      ? 'w-[160px] sm:w-[220px] md:w-[260px] pl-[34px] pr-8 text-slate-100 placeholder:text-slate-500' 
                      : 'w-[36px] sm:w-[160px] pl-[34px] pr-0 sm:pr-3 text-transparent sm:text-slate-100 placeholder:text-transparent sm:placeholder:text-slate-500'
                  }`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-500 hover:text-slate-300 bg-slate-900 z-10"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="mt-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto px-4">
              <div className="w-32 h-32 mb-6 text-slate-600 bg-slate-800/50 rounded-full flex items-center justify-center">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-100">No projects yet</h3>
              <p className="text-slate-400 mb-6 text-sm">
                Create your first project to start defining schemas and managing content.
              </p>
              <Button onClick={() => setShowNewModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white border-0">
                Create your first project
              </Button>
            </div>
          ) : filteredProjects.length === 0 && searchQuery ? (
            <div className="mt-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto px-4">
              <div className="w-24 h-24 mb-6 text-slate-600 bg-slate-800/30 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-100">No projects found</h3>
              <p className="text-slate-400 mb-6 text-sm">
                We couldn't find any projects matching "{searchQuery}".
              </p>
              <Button onClick={() => setSearchQuery('')} variant="ghost" className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10">
                Clear search
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const totalEntries = project.contentLists.reduce((acc, list) => acc + list.entries.length, 0);
                const config = syncStatusConfig[project.syncStatus];

                return (
                  <div
                    key={project.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col relative group cursor-pointer hover:border-indigo-500 transition-colors shadow-sm"
                    onClick={() => navigate(`/project/${project.id}`)}
                    onContextMenu={(e) => handleContextMenu(e, project.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-lg text-slate-100 truncate pr-4">
                        {project.name}
                      </h3>
                      <button
                        className="p-1.5 -mr-1.5 -mt-1 rounded-md hover:bg-slate-800 hover:text-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, project.id);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900/50 rounded-md p-3 border border-slate-800/50">
                          <div className="text-slate-500 text-xs mb-1 font-medium uppercase tracking-wider">Schemas</div>
                          <div className="font-mono text-lg font-semibold text-slate-200">{project.schemas.length}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-md p-3 border border-slate-800/50">
                          <div className="text-slate-500 text-xs mb-1 font-medium uppercase tracking-wider">Entries</div>
                          <div className="font-mono text-lg font-semibold text-slate-200">{totalEntries}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate">
                        Updated {new Date(project.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <Badge variant={config.variant} dot>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {/* Add New Project Card */}
              <div
                className="group flex flex-col items-center justify-center bg-slate-900/20 border border-slate-800/60 hover:border-indigo-500/50 hover:bg-indigo-950/20 rounded-xl p-4 cursor-pointer transition-all border-dashed text-slate-500 hover:text-indigo-400 min-h-[180px]"
                onClick={() => setShowNewModal(true)}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800/40 group-hover:bg-indigo-500/20 flex items-center justify-center mb-3 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-sm font-medium">New Project</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 p-6 rounded-xl w-full max-w-md shadow-2xl border border-slate-700 transform animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-4 text-slate-100">New Project</h2>
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-400 mb-1">Project Name</label>
              <input
                type="text"
                className={`w-full px-3 py-2 text-sm rounded-md bg-slate-950 text-slate-100 border focus:ring-1 outline-none transition-all placeholder:text-slate-600 ${
                  newProjectError 
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500' 
                    : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
                placeholder="e.g. Dialogue Trees"
                value={newProjectName}
                onChange={(e) => {
                  setNewProjectName(e.target.value);
                  setNewProjectError('');
                }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
              />
              {newProjectError && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {newProjectError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setShowNewModal(false); setNewProjectName(''); setNewProjectError(''); }} className="text-slate-300 hover:bg-slate-800 hover:text-slate-100">Cancel</Button>
              <Button onClick={handleCreateProject} className="bg-indigo-600 hover:bg-indigo-500 text-white border-0">Create</Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 p-6 rounded-xl w-full max-w-md shadow-2xl border border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-slate-100">Rename Project</h2>
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-400 mb-1">Project Name</label>
              <input
                type="text"
                className={`w-full px-3 py-2 text-sm rounded-md bg-slate-950 text-slate-100 border focus:ring-1 outline-none transition-all ${
                  renameError 
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500' 
                    : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
                value={renameName}
                onChange={(e) => {
                  setRenameName(e.target.value);
                  setRenameError('');
                }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
              />
              {renameError && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {renameError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setRenameId(null); setRenameError(''); }} className="text-slate-300 hover:bg-slate-800 hover:text-slate-100">Cancel</Button>
              <Button onClick={handleRename} className="bg-indigo-600 hover:bg-indigo-500 text-white border-0">Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
            onClick={() => openRename(contextMenu.projectId)}
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Rename
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
            onClick={() => { duplicateProject(contextMenu.projectId); setContextMenu(null); }}
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Duplicate
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2 border-b border-slate-700/50"
            onClick={() => { console.log('Export', contextMenu.projectId); setContextMenu(null); }}
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            onClick={() => { deleteProject(contextMenu.projectId); setContextMenu(null); }}
          >
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>
        </div>
      )}

      {/* ── Mobile Floating Action Button ── */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowNewModal(true)}
          className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-900/50 transition-transform active:scale-95"
          title="New Project"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
