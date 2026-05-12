import type { Project, Schema, SchemaField, Entry } from './types';

export class FloatNumber {
  constructor(public value: string) {
    if (!this.value.includes('.')) {
      this.value += '.0';
    }
  }
  toJSON() {
    return `__FLOAT__${this.value}__FLOAT__`;
  }
}

/** Resolve a single entry value for a field (returns undefined if missing) */
function resolveField(field: SchemaField, entry: Entry): unknown {
  const raw = entry[field.name];

  switch (field.type) {
    case 'number':
      return typeof raw === 'number' ? raw : Number(raw ?? 0);

    case 'number-nullable':
      return raw === null || raw === undefined || raw === '' ? null : Number(raw);

    case 'float':
      return new FloatNumber(String(raw ?? '0.0'));

    case 'float-nullable':
      if (raw === null || raw === undefined || raw === '') return null;
      return new FloatNumber(String(raw));

    case 'toggle':
      return Boolean(raw);

    case 'tags':
      return Array.isArray(raw) ? raw : [];

    case 'object-optional': {
      if (raw === null || raw === undefined) return null;
      if (!field.subFields?.length) return raw;
      const nested: Entry = {};
      for (const sub of field.subFields) {
        nested[sub.name] = resolveField(sub, (raw as Entry) ?? {});
      }
      return nested;
    }

    case 'list': {
      // list type inside an object — rare, but handle gracefully
      if (!Array.isArray(raw)) return [];
      return raw;
    }

    default:
      // short-text, long-text, dropdown
      return raw ?? '';
  }
}

/**
 * Reconstruct the exact original JSON shape from project data.
 * - rootFields → top-level scalar/object keys
 * - listFields → top-level array keys (populated from ContentList entries)
 */
export function buildJSON(
  project: Project,
  schemaId: string
): Record<string, unknown> {
  const schema: Schema | undefined = project.schemas.find((s) => s.id === schemaId);
  if (!schema) throw new Error(`Schema "${schemaId}" not found in project "${project.id}"`);

  const result: Record<string, unknown> = {};

  // Root metadata fields (single entry, keyed by schemaId convention)
  const rootEntry: Entry =
    (project.contentLists.find(
      (cl) => cl.schemaId === schemaId && cl.listFieldName === '__root__'
    )?.entries[0]) ?? {};

  for (const field of schema.rootFields) {
    result[field.name] = resolveField(field, rootEntry);
  }

  // List fields — each maps to a ContentList
  for (const field of schema.listFields) {
    const cl = project.contentLists.find(
      (c) => c.schemaId === schemaId && c.listFieldName === field.name
    );
    const entries = cl?.entries ?? [];

    result[field.name] = entries.map((entry) => {
      if (!field.subFields?.length) return entry;
      const item: Record<string, unknown> = {};
      for (const sub of field.subFields) {
        item[sub.name] = resolveField(sub, entry);
      }
      return item;
    });
  }

  return result;
}
