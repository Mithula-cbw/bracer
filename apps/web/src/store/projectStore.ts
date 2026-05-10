import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Schema, Entry } from '../../../../packages/core/src/types';

// ─── helpers ────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

// ─── store shape ────────────────────────────────────────────────────────────

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;

  // project actions
  createProject: (name: string) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => Project;

  // schema actions
  addSchema: (projectId: string, schema: Schema) => void;
  updateSchema: (projectId: string, schemaId: string, updates: Partial<Schema>) => void;
  deleteSchema: (projectId: string, schemaId: string) => void;
  copySchema: (fromProjectId: string, fromSchemaId: string, toProjectId: string, newName: string) => Schema;

  // entry actions
  addEntry: (projectId: string, schemaId: string, listFieldName: string, entry: Entry) => void;
  updateEntry: (projectId: string, schemaId: string, listFieldName: string, entryIndex: number, entry: Entry) => void;
  deleteEntry: (projectId: string, schemaId: string, listFieldName: string, entryIndex: number) => void;
  duplicateEntry: (projectId: string, schemaId: string, listFieldName: string, entryIndex: number) => void;

  // misc
  setActiveProject: (id: string | null) => void;
  bumpVersion: (projectId: string) => void;
}

// ─── internal mutator ───────────────────────────────────────────────────────

function mutateProject(
  projects: Project[],
  projectId: string,
  fn: (p: Project) => Project,
): Project[] {
  return projects.map((p) => (p.id === projectId ? fn(p) : p));
}

function bump(p: Project): Project {
  return { ...p, version: p.version + 1, lastModified: now() };
}

// ─── store ──────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      // ── projects ──────────────────────────────────────────────────────────

      createProject(name) {
        const project: Project = {
          id: uid(),
          name: name.trim(),
          created: now(),
          lastModified: now(),
          lastModifiedBy: 'Me',
          version: 1,
          schemas: [],
          contentLists: [],
          syncStatus: 'local',
        };
        set((s) => ({ projects: [project, ...s.projects] }));
        return project;
      },

      updateProject(id, updates) {
        set((s) => ({
          projects: mutateProject(s.projects, id, (p) =>
            bump({ ...p, ...updates }),
          ),
        }));
      },

      deleteProject(id) {
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        }));
      },

      duplicateProject(id) {
        const source = get().projects.find((p) => p.id === id);
        if (!source) throw new Error(`Project ${id} not found`);
        const copy: Project = {
          ...source,
          id: uid(),
          name: `${source.name} (Copy)`,
          created: now(),
          lastModified: now(),
          version: 1,
          syncStatus: 'local',
          schemas: source.schemas.map((s) => ({ ...s, id: uid() })),
          contentLists: source.contentLists.map((cl) => ({
            ...cl,
            entries: cl.entries.map((e) => ({ ...e })),
          })),
        };
        set((s) => {
          const idx = s.projects.findIndex((p) => p.id === id);
          const next = [...s.projects];
          next.splice(idx + 1, 0, copy);
          return { projects: next };
        });
        return copy;
      },

      // ── schemas ───────────────────────────────────────────────────────────

      addSchema(projectId, schema) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            bump({ ...p, schemas: [...p.schemas, schema] }),
          ),
        }));
      },

      updateSchema(projectId, schemaId, updates) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            bump({
              ...p,
              schemas: p.schemas.map((sc) =>
                sc.id === schemaId ? { ...sc, ...updates } : sc,
              ),
            }),
          ),
        }));
      },

      deleteSchema(projectId, schemaId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            bump({
              ...p,
              schemas: p.schemas.filter((sc) => sc.id !== schemaId),
              contentLists: p.contentLists.filter((cl) => cl.schemaId !== schemaId),
            }),
          ),
        }));
      },

      copySchema(fromProjectId, fromSchemaId, toProjectId, newName) {
        const fromProject = get().projects.find((p) => p.id === fromProjectId);
        if (!fromProject) throw new Error(`Project ${fromProjectId} not found`);
        const source = fromProject.schemas.find((s) => s.id === fromSchemaId);
        if (!source) throw new Error(`Schema ${fromSchemaId} not found`);

        const copy: Schema = { ...source, id: uid(), name: newName };
        set((s) => ({
          projects: mutateProject(s.projects, toProjectId, (p) =>
            bump({ ...p, schemas: [...p.schemas, copy] }),
          ),
        }));
        return copy;
      },

      // ── entries ───────────────────────────────────────────────────────────

      addEntry(projectId, schemaId, listFieldName, entry) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => {
            const lists = p.contentLists.map((cl) =>
              cl.schemaId === schemaId && cl.listFieldName === listFieldName
                ? { ...cl, entries: [...cl.entries, entry] }
                : cl,
            );
            // create list if it doesn't exist yet
            const exists = p.contentLists.some(
              (cl) => cl.schemaId === schemaId && cl.listFieldName === listFieldName,
            );
            return bump({
              ...p,
              contentLists: exists
                ? lists
                : [...p.contentLists, { schemaId, listFieldName, entries: [entry] }],
            });
          }),
        }));
      },

      updateEntry(projectId, schemaId, listFieldName, entryIndex, entry) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            bump({
              ...p,
              contentLists: p.contentLists.map((cl) => {
                if (cl.schemaId !== schemaId || cl.listFieldName !== listFieldName) return cl;
                const entries = [...cl.entries];
                entries[entryIndex] = entry;
                return { ...cl, entries };
              }),
            }),
          ),
        }));
      },

      deleteEntry(projectId, schemaId, listFieldName, entryIndex) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            bump({
              ...p,
              contentLists: p.contentLists.map((cl) => {
                if (cl.schemaId !== schemaId || cl.listFieldName !== listFieldName) return cl;
                const entries = [...cl.entries];
                entries.splice(entryIndex, 1);
                return { ...cl, entries };
              }),
            }),
          ),
        }));
      },

      duplicateEntry(projectId, schemaId, listFieldName, entryIndex) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            bump({
              ...p,
              contentLists: p.contentLists.map((cl) => {
                if (cl.schemaId !== schemaId || cl.listFieldName !== listFieldName) return cl;
                const entries = [...cl.entries];
                entries.splice(entryIndex + 1, 0, { ...entries[entryIndex] });
                return { ...cl, entries };
              }),
            }),
          ),
        }));
      },

      // ── misc ──────────────────────────────────────────────────────────────

      setActiveProject(id) {
        set({ activeProjectId: id });
      },

      bumpVersion(projectId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, bump),
        }));
      },
    }),
    {
      name: 'bracer-projects',
    },
  ),
);
