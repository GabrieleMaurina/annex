import {
  Collection,
  CreateIndexesOptions,
  Db,
  Document,
  MongoClient,
} from 'mongodb';

const { MONGO_USER, MONGO_PASS } = process.env;

const authenticated = Boolean(MONGO_USER && MONGO_PASS);

const uri = authenticated
  ? `mongodb://${encodeURIComponent(MONGO_USER as string)}:${encodeURIComponent(MONGO_PASS as string)}@localhost:27017/?authSource=annex`
  : 'mongodb://localhost:27017';

const client = new MongoClient(uri);

let db: Db;

export function connect(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !authenticated)
    return Promise.reject(
      new Error('MONGO_USER and MONGO_PASS are required in production'),
    );
  return client.connect().then((connected) => {
    db = connected.db('annex');
  });
}

export function getCollection<T extends Document>(name: string): Collection<T> {
  return db.collection<T>(name);
}

export function getDb(): Db {
  return db;
}

export interface IndexSpec {
  key: Record<string, 1 | -1>;
  options?: CreateIndexesOptions;
}

export interface CollectionSpec {
  name: string;
  schema: Record<string, unknown>;
  indexes: IndexSpec[];
}

export function applySchema({
  name,
  schema,
}: CollectionSpec): Promise<unknown> {
  return db
    .listCollections({ name })
    .toArray()
    .then((found) =>
      found.length
        ? db.command({ collMod: name, ...schema })
        : db.createCollection(name, schema),
    );
}

export function ensureCollection(spec: CollectionSpec): Promise<unknown> {
  return applySchema(spec).then(() =>
    Promise.all(
      spec.indexes.map(({ key, options }) =>
        db.collection(spec.name).createIndex(key, options),
      ),
    ),
  );
}
