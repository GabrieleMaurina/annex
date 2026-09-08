import { Binary, Document, FindCursor, ObjectId } from 'mongodb';
import { connect, getCollection, getDb } from './db/mongo';

type Node = Record<string, unknown>;

const NUMERIC = ['number', 'int', 'long', 'double', 'decimal'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bsonTypes(node: Node): string[] {
  const type = node.bsonType;
  if (typeof type === 'string') return [type];
  if (Array.isArray(type))
    return type.filter((entry): entry is string => typeof entry === 'string');
  return [];
}

function valueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof ObjectId) return 'objectId';
  if (value instanceof Binary) return 'binData';
  const type = typeof value;
  if (type === 'boolean') return 'bool';
  if (type === 'string' || type === 'number' || type === 'object') return type;
  return 'unknown';
}

function matchesType(value: unknown, types: string[]): boolean {
  if (types.length === 0) return true;
  const actual = valueType(value);
  if (types.includes(actual)) return true;
  return actual === 'number' && types.some((type) => NUMERIC.includes(type));
}

function typeValid(value: unknown, node: Node): boolean {
  if (Array.isArray(node.enum)) return node.enum.includes(value);
  return matchesType(value, bsonTypes(node));
}

function clampToConstraints(
  value: unknown,
  node: Node,
  path: string,
  changes: string[],
): unknown {
  const label = path || '(root)';
  if (typeof value === 'number') {
    if (typeof node.minimum === 'number' && value < node.minimum) {
      changes.push(`${label}: ${value} raised to minimum ${node.minimum}`);
      return node.minimum;
    }
    if (typeof node.maximum === 'number' && value > node.maximum) {
      changes.push(`${label}: ${value} lowered to maximum ${node.maximum}`);
      return node.maximum;
    }
  }
  if (typeof value === 'string') {
    if (typeof node.maxLength === 'number' && value.length > node.maxLength) {
      changes.push(`${label}: truncated to maxLength ${node.maxLength}`);
      return value.slice(0, node.maxLength);
    }
    if (
      (typeof node.minLength === 'number' && value.length < node.minLength) ||
      (typeof node.pattern === 'string' &&
        !new RegExp(node.pattern).test(value))
    )
      changes.push(`${label}: ${preview(value)} still invalid, cannot repair`);
  }
  if (Array.isArray(value)) {
    if (typeof node.maxItems === 'number' && value.length > node.maxItems) {
      changes.push(`${label}: truncated to maxItems ${node.maxItems}`);
      return value.slice(0, node.maxItems);
    }
    if (
      typeof node.minItems === 'number' &&
      value.length < node.minItems &&
      isObject(node.items)
    ) {
      changes.push(`${label}: padded to minItems ${node.minItems}`);
      const items = node.items;
      const padded = value.slice();
      while (padded.length < node.minItems) padded.push(schemaDefault(items));
      return padded;
    }
  }
  return value;
}

function buildObject(node: Node): Record<string, unknown> {
  const props = isObject(node.properties) ? node.properties : {};
  const required = Array.isArray(node.required) ? node.required : [];
  const out: Record<string, unknown> = {};
  for (const key of required)
    if (typeof key === 'string' && key !== '_id')
      out[key] = schemaDefault(isObject(props[key]) ? props[key] : {});
  return out;
}

function schemaDefault(node: Node): unknown {
  if (Array.isArray(node.enum)) return node.enum[0];
  const types = bsonTypes(node);
  if (types.includes('null')) return null;
  switch (types[0]) {
    case 'string':
      return '';
    case 'number':
    case 'int':
    case 'long':
    case 'double':
    case 'decimal':
      return 0;
    case 'bool':
      return false;
    case 'array':
      return [];
    case 'date':
      return new Date(0);
    case 'object':
      return buildObject(node);
    default:
      return null;
  }
}

function preview(value: unknown): string {
  const text =
    value instanceof ObjectId ? value.toString() : JSON.stringify(value);
  if (typeof text !== 'string') return String(value);
  return text.length > 60 ? `${text.slice(0, 60)}...` : text;
}

function reconcile(
  value: unknown,
  node: Node,
  path: string,
  changes: string[],
): unknown {
  if (node.oneOf || node.anyOf || node.allOf) return value;
  if (!typeValid(value, node)) {
    changes.push(`${path || '(root)'}: ${preview(value)} reset to default`);
    return schemaDefault(node);
  }
  value = clampToConstraints(value, node, path, changes);
  const types = bsonTypes(node);
  if (
    types.includes('object') &&
    isObject(value) &&
    isObject(node.properties)
  ) {
    const props = node.properties;
    const additionalAllowed = node.additionalProperties !== false;
    const required = Array.isArray(node.required) ? node.required : [];
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const child = props[key];
      const childPath = path ? `${path}.${key}` : key;
      if (isObject(child))
        out[key] = reconcile(entry, child, childPath, changes);
      else if (additionalAllowed) out[key] = entry;
      else changes.push(`${childPath}: removed unknown field`);
    }
    for (const key of required)
      if (typeof key === 'string' && key !== '_id' && !(key in out))
        out[key] = schemaDefault(isObject(props[key]) ? props[key] : {});
    return out;
  }
  if (types.includes('array') && Array.isArray(value) && isObject(node.items)) {
    const items = node.items;
    return value.map((entry, index) =>
      reconcile(entry, items, `${path}[${index}]`, changes),
    );
  }
  return value;
}

function forEachDoc(
  cursor: FindCursor<Document>,
  handle: (doc: Document) => Promise<void>,
): Promise<void> {
  return cursor.next().then((doc) => {
    if (!doc) return undefined;
    return handle(doc).then(() => forEachDoc(cursor, handle));
  });
}

function checkCollection(name: string, schema: Document): Promise<void> {
  const coll = getCollection<Document>(name);
  const counts = { fixed: 0, skipped: 0 };
  const cursor = coll.find({ $nor: [{ $jsonSchema: schema }] });
  return forEachDoc(cursor, (doc) => {
    const changes: string[] = [];
    const fixed = reconcile(doc, schema, '', changes) as Document;
    const label = `[schemaCheck] ${name} ${String(doc._id)}`;
    return coll
      .replaceOne({ _id: doc._id }, fixed, { bypassDocumentValidation: true })
      .then(
        () => {
          counts.fixed += 1;
          if (changes.length) console.log(`${label}: ${changes.join('; ')}`);
        },
        (error: Error) => {
          counts.skipped += 1;
          if (changes.length) console.log(`${label}: ${changes.join('; ')}`);
          console.error(`${label} not saved: ${error.message}`);
        },
      );
  }).then(() => {
    if (counts.fixed || counts.skipped)
      console.log(
        `[schemaCheck] ${name}: fixed ${counts.fixed}, skipped ${counts.skipped}`,
      );
  });
}

export function checkDbSchema(): Promise<void> {
  return connect()
    .then(() => getDb().listCollections({}, { nameOnly: false }).toArray())
    .then((infos) =>
      infos.reduce((chain, info) => {
        const schema = (
          info.options?.validator as { $jsonSchema?: Document } | undefined
        )?.$jsonSchema;
        return schema
          ? chain.then(() => checkCollection(info.name, schema))
          : chain;
      }, Promise.resolve()),
    )
    .then(() => undefined);
}

if (require.main === module)
  checkDbSchema()
    .then(() => {
      console.log('[schemaCheck] complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[schemaCheck] failed', error);
      process.exit(1);
    });
