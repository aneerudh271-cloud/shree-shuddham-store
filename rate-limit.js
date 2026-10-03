import { createHash } from 'node:crypto';

export async function enforceRateLimit(db, req, namespace, limit, windowMs) {
  const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown';
  const ip = String(forwarded).split(',')[0].trim().slice(0, 64);
  const bucket = Math.floor(Date.now() / windowMs);
  const digest = createHash('sha256').update(`${namespace}:${ip}`).digest('hex');
  const key = `${digest}:${bucket}`;
  const expiresAt = new Date((bucket + 2) * windowMs);
  const collection = db.collection('api_rate_limits');
  try {
    await collection.updateOne({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await collection.updateOne({ key }, { $inc: { count: 1 } });
  }
  const record = await collection.findOne({ key }, { projection: { count: 1 } });
  if ((record?.count || 0) > limit) {
    const error = new Error('Too many requests. Please wait a few minutes and try again.');
    error.status = 429;
    throw error;
  }
}
