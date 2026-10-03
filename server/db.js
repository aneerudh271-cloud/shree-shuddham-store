import { MongoClient, ServerApiVersion } from 'mongodb';

let clientPromise;
let indexesPromise;

export async function getDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');
  if (!process.env.MONGODB_DB) throw new Error('MONGODB_DB is not configured.');
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 8,
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      db.collection('admin_users').createIndex({ key: 1 }, { unique: true }),
      db.collection('admin_sessions').createIndex({ tokenHash: 1 }, { unique: true }),
      db.collection('admin_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('orders').createIndex({ id: 1 }, { unique: true }),
      db.collection('orders').createIndex({ createdAt: -1, _id: -1 }),
      db.collection('orders').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('products').createIndex({ id: 1 }, { unique: true }),
      db.collection('coupons').createIndex({ code: 1 }, { unique: true }),
      db.collection('pincodes').createIndex({ pin: 1 }, { unique: true }),
      db.collection('login_limits').createIndex({ key: 1 }, { unique: true }),
      db.collection('login_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('api_rate_limits').createIndex({ key: 1 }, { unique: true }),
      db.collection('api_rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    ]).catch((error) => {
      indexesPromise = undefined;
      throw error;
    });
  }
  await indexesPromise;
  return db;
}

export function toPublicProduct(product) {
  if (!product) return product;
  const { _id, ...publicFields } = product;
  return { ...publicFields, id: String(product.id || _id) };
}

export function toPublicOrder(order) {
  if (!order) return order;
  const { _id, ...publicFields } = order;
  return { ...publicFields, id: String(order.id || _id) };
}
