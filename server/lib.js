'use strict';

/**
 * ============================================================================
 *  مؤسسة الفردوس الإسلامية — طبقة قاعدة البيانات (MongoDB)
 *  Al-Firdous Portal — shared data layer for the local server + Vercel API
 * ============================================================================
 *
 *  Environment variables:
 *    MONGODB_URI   mongodb+srv://user:pass@cluster.../  (Atlas)  |  mongodb://127.0.0.1:27017
 *    MONGODB_DB    database name (default: al_firdous)
 *    API_SECRET    shared secret used by the page (default: CHANGE_ME_123)
 * ============================================================================
 */

const { MongoClient } = require('mongodb');

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?directConnection=true';
const DB_NAME = process.env.MONGODB_DB || 'al_firdous';
const SECRET = process.env.API_SECRET || 'CHANGE_ME_123';

const TYPES = ['staff', 'expenses', 'kafala', 'fath'];

const SCHEMA = {
  staff: { name: 's', job: 's', category: 's', period: 's', branch: 's', salary: 'n', phone: 'd', nationalId: 'd' },
  expenses: { item: 's', amount: 'n', notes: 's' },
  kafala: { name: 's', nationalId: 'd', phone: 'd', amount: 'n', spouse: 's' },
  fath: { name: 's', nationalId: 'd', phone: 'd', job: 's', salary: 'n' }
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

function str(value) {
  return value == null ? '' : String(value).trim();
}

function western(value) {
  return str(value)
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

function digits(value) {
  return western(value).replace(/[^0-9]/g, '');
}

function num(value) {
  const n = Number(western(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function toId(value) {
  const n = Math.trunc(num(value));
  return n > 0 ? n : 0;
}

/** Keeps only known fields and coerces them to the right type. */
function sanitize(type, record) {
  const shape = SCHEMA[type];
  if (!shape) throw new HttpError(400, 'invalid type');
  const src = record && typeof record === 'object' ? record : {};
  const out = { id: toId(src.id) };
  for (const key of Object.keys(shape)) {
    const kind = shape[key];
    if (kind === 'n') out[key] = num(src[key]);
    else if (kind === 'd') out[key] = digits(src[key]);
    else out[key] = str(src[key]);
  }
  if (type === 'staff') {
    if (!out.category) out.category = 'معلمين';
    if (!out.period) out.period = 'evening';
  }
  return out;
}

// --------------------------------------------------------------------------
// connection (cached between serverless invocations)
// --------------------------------------------------------------------------

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const client = new MongoClient(URI, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        retryWrites: true
      });
      await client.connect();
      const db = client.db(DB_NAME);
      await Promise.all(
        TYPES.map((t) => db.collection(t).createIndex({ id: 1 }, { unique: true }))
      );
      return db;
    })();
    // do not cache a failed connection
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

// --------------------------------------------------------------------------
// reads
// --------------------------------------------------------------------------

async function readAll() {
  const db = await getDb();
  const [staff, expenses, kafala, fath, meta] = await Promise.all([
    db.collection('staff').find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection('expenses').find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection('kafala').find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection('fath').find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection('meta').findOne({ _id: 'rev' })
  ]);
  return {
    ok: true,
    rev: meta && Number(meta.value) ? Number(meta.value) : 0,
    updatedAt: meta && meta.updatedAt ? new Date(meta.updatedAt).toISOString() : null,
    serverTime: new Date().toISOString(),
    staff,
    expenses,
    kafala,
    fath
  };
}

async function counts() {
  const db = await getDb();
  const [staff, expenses, kafala, fath] = await Promise.all(
    TYPES.map((t) => db.collection(t).countDocuments())
  );
  return { staff, expenses, kafala, fath };
}

// --------------------------------------------------------------------------
// writes
// --------------------------------------------------------------------------

async function bumpRev(db) {
  await db
    .collection('meta')
    .updateOne(
      { _id: 'rev' },
      { $inc: { value: 1 }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );
  const meta = await db.collection('meta').findOne({ _id: 'rev' });
  return meta && Number(meta.value) ? Number(meta.value) : 1;
}

function isDuplicateKey(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

async function nextId(db, type) {
  const last = await db
    .collection(type)
    .find({}, { projection: { id: 1 } })
    .sort({ id: -1 })
    .limit(1)
    .next();
  return (last && toId(last.id)) + 1;
}

/** Adds a record. The server always assigns the id so two devices never clash. */
async function addRecord(db, type, record) {
  const doc = sanitize(type, record);
  for (let attempt = 0; attempt < 6; attempt++) {
    doc.id = await nextId(db, type);
    try {
      await db.collection(type).insertOne(Object.assign({}, doc));
      return doc;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      if (attempt === 5) throw new Error('could not allocate a new id');
    }
  }
  throw new Error('could not allocate a new id');
}

async function updateRecord(db, type, record) {
  const doc = sanitize(type, record);
  if (!doc.id) throw new HttpError(400, 'missing record id');
  await db.collection(type).replaceOne({ id: doc.id }, doc, { upsert: true });
  return doc;
}

async function deleteRecord(db, type, id) {
  const key = toId(id);
  if (!key) throw new HttpError(400, 'missing record id');
  const res = await db.collection(type).deleteOne({ id: key });
  return { id: key, deleted: res.deletedCount || 0 };
}

async function replaceAll(db, type, data) {
  if (!SCHEMA[type]) throw new HttpError(400, 'invalid type');
  if (!Array.isArray(data)) throw new HttpError(400, 'data must be an array');
  if (data.length === 0) throw new HttpError(400, 'refusing to replace with an empty list');
  const docs = [];
  const seen = new Set();
  let maxId = 0;
  for (const raw of data) {
    if (raw && toId(raw.id) > maxId) maxId = toId(raw.id);
  }
  for (const raw of data) {
    const doc = sanitize(type, raw);
    if (!doc.id || seen.has(doc.id)) doc.id = ++maxId;
    seen.add(doc.id);
    docs.push(doc);
  }
  await db.collection(type).deleteMany({});
  await db.collection(type).insertMany(docs, { ordered: true });
  return { type, count: docs.length };
}

/** Handles one write action coming from the page. */
async function applyAction(body) {
  const action = str(body && body.action).toLowerCase();
  const type = str(body && body.type).toLowerCase();
  if (TYPES.indexOf(type) === -1) throw new HttpError(400, 'invalid type');

  const db = await getDb();
  let result = null;

  if (action === 'add') {
    result = { record: await addRecord(db, type, body.record) };
  } else if (action === 'update') {
    result = { record: await updateRecord(db, type, body.record) };
  } else if (action === 'delete') {
    result = await deleteRecord(db, type, body.id != null ? body.id : (body.record && body.record.id));
  } else if (action === 'replace') {
    result = await replaceAll(db, type, body.data);
  } else {
    throw new HttpError(400, 'invalid action');
  }

  const rev = await bumpRev(db);
  return Object.assign({ ok: true, type, action, rev }, result);
}

// --------------------------------------------------------------------------
// auth
// --------------------------------------------------------------------------

function checkSecret(value) {
  const given = str(value);
  if (!given || given !== SECRET) throw new HttpError(401, 'unauthorized');
  return true;
}

module.exports = {
  TYPES,
  SCHEMA,
  HttpError,
  getDb,
  readAll,
  counts,
  applyAction,
  replaceAll,
  bumpRev,
  sanitize,
  checkSecret,
  DB_NAME,
  SECRET,
  URI
};
