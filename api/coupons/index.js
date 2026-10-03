import { randomBytes } from 'node:crypto';
import { defaultCoupons } from '../../server/defaults.js';
import { getDatabase } from '../../server/db.js';
import { requireAdmin } from '../../server/auth.js';
import { handleError, methodNotAllowed, readBody, requireInteger, requireString, send, validateOrigin } from '../../server/http.js';

async function seedCoupons(db) {
  const collection = db.collection('coupons');
  if (await collection.estimatedDocumentCount()) return;
  try {
    await collection.insertMany(defaultCoupons);
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}

function publicCoupon(coupon) {
  const { _id, ...value } = coupon;
  return value;
}

export default async function handler(req, res) {
  try {
    const db = await getDatabase();
    await seedCoupons(db);
    const coupons = db.collection('coupons');
    if (req.method === 'GET') {
      const includeInactive = req.query.includeInactive === 'true';
      if (includeInactive && !await requireAdmin(req, res)) return;
      const rows = await coupons.find(includeInactive ? {} : { active: true }, { projection: { _id: 0, createdAt: 0 } }).sort({ code: 1 }).toArray();
      return send(res, 200, { coupons: rows.map(publicCoupon) });
    }
    if (req.method === 'POST') {
      validateOrigin(req);
      if (!await requireAdmin(req, res)) return;
      const body = readBody(req);
      const type = requireString(body.type, 'Discount type', 10);
      if (!['percent', 'fixed'].includes(type)) return send(res, 400, { error: 'Discount type must be percent or fixed.' });
      const value = requireInteger(body.value, 'Discount value', 1, type === 'percent' ? 100 : 10000000);
      const code = `SHUD${randomBytes(4).toString('hex').toUpperCase()}`;
      const coupon = { code, type, value, active: true, createdAt: new Date() };
      await coupons.insertOne(coupon);
      return send(res, 201, { coupon: publicCoupon(coupon) });
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (error) {
    return handleError(res, error);
  }
}
