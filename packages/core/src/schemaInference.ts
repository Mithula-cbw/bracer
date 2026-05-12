import type { Schema, SchemaField, FieldType } from './types';

let _idCounter = 0;
const uid = () => `field_${Date.now()}_${_idCounter++}`;

/** Collect values for a key across all sample entries */
function sampleValues(
  key: string,
  samples: Record<string, unknown>[]
): unknown[] {
  return samples.map((s) => s[key]).filter((v) => v !== undefined);
}

/** Infer a single field's type from its value + cross-sample values */
function inferFieldType(
  key: string,
  value: unknown,
  samples: Record<string, unknown>[]
): FieldType {
  const vals = sampleValues(key, samples);

  // boolean
  if (typeof value === 'boolean') return 'toggle';

  // null / plain object (non-array)
  if (value === null || (typeof value === 'object' && !Array.isArray(value)))
    return 'object-optional';

  // array
  if (Array.isArray(value)) {
    if (value.length === 0) return 'tags'; // default empty array → tags
    if (typeof value[0] === 'string') return 'tags';
    if (typeof value[0] === 'object') return 'list';
    return 'tags';
  }

  // number
  if (typeof value === 'number') {
    const hasNull = vals.some((v) => v === null);
    const isFloat = vals.some((v) => typeof v === 'number' && v % 1 !== 0);
    if (isFloat) return hasNull ? 'float-nullable' : 'float';
    return hasNull ? 'number-nullable' : 'number';
  }

  // string
  if (typeof value === 'string') {
    // Dropdown: ≤5 unique string values across samples
    const strVals = vals.filter((v) => typeof v === 'string') as string[];
    const unique = new Set(strVals);
    if (strVals.length > 0 && unique.size <= 5) return 'dropdown';

    // Long-text: average length > 60
    const avg = strVals.reduce((s, v) => s + v.length, 0) / (strVals.length || 1);
    if (avg > 60) return 'long-text';

    return 'short-text';
  }

  return 'short-text';
}

/** Infer options list for dropdown fields */
function inferOptions(
  key: string,
  samples: Record<string, unknown>[]
): string[] {
  const vals = sampleValues(key, samples).filter(
    (v): v is string => typeof v === 'string'
  );
  return [...new Set(vals)];
}

/** Recursively build SchemaFields from an object shape */
function inferFields(
  obj: Record<string, unknown>,
  samples: Record<string, unknown>[]
): SchemaField[] {
  return Object.entries(obj).map(([key, value]) => {
    const type = inferFieldType(key, value, samples);

    const field: SchemaField = {
      id: uid(),
      name: key,
      label: key.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      type,
      required: false,
    };

    if (type === 'dropdown') {
      field.options = inferOptions(key, samples);
    }

    // Recurse into object-optional subfields
    if (type === 'object-optional' && value !== null && typeof value === 'object') {
      field.subFields = inferFields(
        value as Record<string, unknown>,
        samples
          .map((s) => s[key])
          .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v))
      );
    }

    // Recurse into list item subfields
    if (type === 'list' && Array.isArray(value) && value.length > 0) {
      const listSamples = samples
        .flatMap((s) => {
          const arr = s[key];
          return Array.isArray(arr) ? arr : [];
        })
        .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null);

      field.subFields = inferFields(value[0] as Record<string, unknown>, listSamples);
    }

    return field;
  });
}

/**
 * Infer a Schema from a JSON object shape plus optional sample entries.
 * - Top-level non-array fields → rootFields
 * - Top-level array-of-objects fields → listFields (sub-fields inferred)
 */
export function inferSchemaFromJSON(
  json: Record<string, unknown>,
  sampleEntries: Record<string, unknown>[] = []
): Schema {
  const rootFields: SchemaField[] = [];
  const listFields: SchemaField[] = [];

  for (const [key, value] of Object.entries(json)) {
    if (Array.isArray(value) && (value.length === 0 || typeof value[0] === 'object')) {
      // Array of objects → listField with subFields
      const listSamples = sampleEntries
        .flatMap((s) => {
          const arr = s[key];
          return Array.isArray(arr) ? arr : [];
        })
        .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null);

      const firstItem = value[0] as Record<string, unknown> | undefined;

      listFields.push({
        id: uid(),
        name: key,
        label: key.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        type: 'list',
        required: false,
        subFields: firstItem ? inferFields(firstItem, listSamples) : [],
      });
    } else {
      // Scalar / object → rootField
      const [field] = inferFields({ [key]: value }, sampleEntries);
      rootFields.push(field);
    }
  }

  return {
    id: uid(),
    name: 'Inferred Schema',
    rootFields,
    listFields,
  };
}
