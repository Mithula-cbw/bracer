// ─── useDriveSync ─────────────────────────────────────────────────────────────
//
// High-level sync hook. Folder layout in Drive:
//
//   Bracer/
//   └── <ProjectName>/
//       ├── project.meta.json
//       ├── schemas/
//       │   └── <schemaname>.schema.json
//       └── content/
//           └── <schemaname>.json
//
// project.meta.json shape:
//   { id, name, created, lastModified, lastModifiedBy, version,
//     syncBackend: 'drive' }

import { useCallback, useState } from 'react';
import {
  ensureFolder,
  uploadFile,
  downloadFile,
  findFile,
  listFiles,
} from '../../../../packages/core/src/sync/driveService';
import { useProjectStore } from '../store/projectStore';
import type { Project, Schema, ContentList } from '../../../../packages/core/src/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriveSyncState {
  isSyncing: boolean;
  lastError: string | null;
  syncProject: (project: Project) => Promise<void>;
  loadProjectFromDrive: (projectFolderId: string) => Promise<Project>;
  checkConflict: (project: Project) => Promise<boolean>;
  resolveConflict: (project: Project, useLocal: boolean) => Promise<void>;
}

// ── Sanitise name for Drive filename ─────────────────────────────────────────

function safeName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'unnamed';
}

// ── project.meta.json shape ───────────────────────────────────────────────────

interface ProjectMeta {
  id: string;
  name: string;
  created: string;
  lastModified: string;
  lastModifiedBy: string;
  version: number;
  syncBackend: 'drive';
}

function buildMeta(project: Project): ProjectMeta {
  return {
    id:             project.id,
    name:           project.name,
    created:        project.created,
    lastModified:   project.lastModified,
    lastModifiedBy: project.lastModifiedBy,
    version:        project.version,
    syncBackend:    'drive',
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDriveSync(): DriveSyncState {
  const [isSyncing,  setIsSyncing]  = useState(false);
  const [lastError,  setLastError]  = useState<string | null>(null);

  const updateProject = useProjectStore((s) => s.updateProject);
  const bumpVersion   = useProjectStore((s) => s.bumpVersion);

  // ── syncProject ─────────────────────────────────────────────────────────────

  const syncProject = useCallback(async (project: Project) => {
    setIsSyncing(true);
    setLastError(null);

    try {
      // 1. Mark project as syncing
      updateProject(project.id, { syncStatus: 'syncing' });

      // 2. Bump version before sync
      bumpVersion(project.id);

      // Re-read the bumped project from store (via closure is stale; use the
      // bump result directly by computing the next version locally)
      const syncedProject: Project = {
        ...project,
        version: project.version + 1,
        lastModified: new Date().toISOString(),
      };

      // 3. Ensure folder structure: Bracer/ → ProjectName/ → schemas/ + content/
      const rootFolderId    = await ensureFolder('Bracer');
      const projectFolderId = await ensureFolder(safeName(project.name), rootFolderId);
      const schemasFolderId = await ensureFolder('schemas', projectFolderId);
      const contentFolderId = await ensureFolder('content', projectFolderId);

      // 4. Upload project.meta.json
      const metaContent   = JSON.stringify(buildMeta(syncedProject), null, 2);
      const existingMetaId = await findFile('project.meta.json', projectFolderId);
      await uploadFile('project.meta.json', metaContent, projectFolderId, existingMetaId ?? undefined);

      // 5. Upload each schema
      for (const schema of project.schemas) {
        const fileName = `${safeName(schema.name)}.schema.json`;
        const content  = JSON.stringify(schema, null, 2);
        const existingId = await findFile(fileName, schemasFolderId);
        await uploadFile(fileName, content, schemasFolderId, existingId ?? undefined);
      }

      // 6. Upload each content list (grouped by schema)
      // Group content lists by schema, merge them into one object per schema
      const bySchema: Record<string, Record<string, unknown[]>> = {};
      for (const cl of project.contentLists) {
        const schema = project.schemas.find((s) => s.id === cl.schemaId);
        if (!schema) continue;
        const key = safeName(schema.name);
        if (!bySchema[key]) bySchema[key] = {};
        bySchema[key][cl.listFieldName] = cl.entries;
      }

      for (const [schemaKey, data] of Object.entries(bySchema)) {
        const fileName   = `${schemaKey}.json`;
        const content    = JSON.stringify(data, null, 2);
        const existingId = await findFile(fileName, contentFolderId);
        await uploadFile(fileName, content, contentFolderId, existingId ?? undefined);
      }

      // 7. Persist the Drive folder ID and mark as synced
      updateProject(project.id, {
        syncStatus:  'synced',
        driveFolder: projectFolderId,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed.';
      setLastError(msg);
      updateProject(project.id, { syncStatus: 'error' });
    } finally {
      setIsSyncing(false);
    }
  }, [updateProject, bumpVersion]);

  // ── loadProjectFromDrive ────────────────────────────────────────────────────

  const loadProjectFromDrive = useCallback(async (projectFolderId: string): Promise<Project> => {
    // 1. Download meta
    const metaId = await findFile('project.meta.json', projectFolderId);
    if (!metaId) throw new Error('project.meta.json not found in Drive folder.');
    const meta: ProjectMeta = JSON.parse(await downloadFile(metaId));

    // 2. Download schemas
    const schemasFolderId = await ensureFolder('schemas', projectFolderId);
    const schemaFiles     = await listFiles(schemasFolderId);
    const schemas: Schema[] = await Promise.all(
      schemaFiles
        .filter((f) => f.name.endsWith('.schema.json'))
        .map(async (f) => JSON.parse(await downloadFile(f.id)) as Schema),
    );

    // 3. Download content lists
    const contentFolderId = await ensureFolder('content', projectFolderId);
    const contentFiles    = await listFiles(contentFolderId);
    const contentLists: ContentList[] = [];

    for (const file of contentFiles.filter((f) => f.name.endsWith('.json'))) {
      const data: Record<string, unknown[]> = JSON.parse(await downloadFile(file.id));
      for (const [listFieldName, entries] of Object.entries(data)) {
        // Match to a schema by filename stem (schemaname.json → schemaname)
        const stem   = file.name.replace(/\.json$/, '');
        const schema = schemas.find((s) => safeName(s.name) === stem);
        if (!schema) continue;
        contentLists.push({ schemaId: schema.id, listFieldName, entries });
      }
    }

    const project: Project = {
      id:             meta.id,
      name:           meta.name,
      created:        meta.created,
      lastModified:   meta.lastModified,
      lastModifiedBy: meta.lastModifiedBy,
      version:        meta.version,
      schemas,
      contentLists,
      syncStatus:  'synced',
      driveFolder: projectFolderId,
    };

    return project;
  }, []);

  // ── checkConflict ───────────────────────────────────────────────────────────

  const checkConflict = useCallback(async (project: Project): Promise<boolean> => {
    if (!project.driveFolder) return false;
    try {
      const metaId = await findFile('project.meta.json', project.driveFolder);
      if (!metaId) return false; // nothing on Drive yet
      const driveMeta: ProjectMeta = JSON.parse(await downloadFile(metaId));
      // Conflict when Drive version is newer than local
      return driveMeta.version > project.version;
    } catch {
      return false;
    }
  }, []);

  // ── resolveConflict ─────────────────────────────────────────────────────────

  const resolveConflict = useCallback(async (project: Project, useLocal: boolean) => {
    if (useLocal) {
      // Push local state to Drive, overwriting what's there
      await syncProject(project);
    } else {
      // Pull from Drive and merge into store
      if (!project.driveFolder) throw new Error('No Drive folder ID on this project.');
      const remote = await loadProjectFromDrive(project.driveFolder);
      // Overwrite the local project with the remote version
      updateProject(project.id, {
        name:           remote.name,
        schemas:        remote.schemas,
        contentLists:   remote.contentLists,
        version:        remote.version,
        lastModified:   remote.lastModified,
        lastModifiedBy: remote.lastModifiedBy,
        syncStatus:     'synced',
      });
    }
  }, [syncProject, loadProjectFromDrive, updateProject]);

  return { isSyncing, lastError, syncProject, loadProjectFromDrive, checkConflict, resolveConflict };
}
