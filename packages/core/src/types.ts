export type FieldType =
  | 'short-text'
  | 'long-text'
  | 'number'
  | 'number-nullable'
  | 'float'
  | 'float-nullable'
  | 'toggle'
  | 'dropdown'
  | 'tags'
  | 'object-optional'
  | 'list';

export interface SchemaField {
  id: string;
  name: string;          // JSON key
  label: string;         // display label
  type: FieldType;
  required: boolean;
  options?: string[];    // dropdown only
  subFields?: SchemaField[]; // object-optional & list only
}

export interface Schema {
  id: string;
  name: string;
  rootFields: SchemaField[];  // metadata (set once)
  listFields: SchemaField[];  // array fields (add items to)
}

export type Entry = Record<string, unknown>;

export interface ContentList {
  schemaId: string;
  listFieldName: string; // e.g. "cards"
  entries: Entry[];
}

export interface Project {
  id: string;
  name: string;
  created: string;          // ISO date
  lastModified: string;     // ISO datetime
  lastModifiedBy: string;
  version: number;
  schemas: Schema[];
  contentLists: ContentList[];
  syncStatus: 'synced' | 'syncing' | 'conflict' | 'local' | 'error';
  driveFolder?: string;     // Drive folder ID for this project
  syncBackend?: 'drive';    // set when the project has been pushed to Drive
}

export interface AppState {
  projects: Project[];
  activeProjectId: string | null;
  activeSchemaId: string | null;
}
