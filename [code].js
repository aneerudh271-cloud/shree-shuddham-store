import { getDatabase } from '../../server/db.js';
import { handleError, methodNotAllowed, readBody, send, validateOrigin } from '../../server/http.js';
import { requireAdmin } from '../../server/auth.js';

export default async function handler(req, res) {
  try {
    validateOrigin(req);
    if (!await requireAdmin(req, res)) return;
    const code = String(req.query.code || '').toUpperCase();
    if (!/^[A-Z0-9_-]{4,32}$/.test(code)) return send(res, 400, { error: 'Invalid coupon code.' });
    const coupons = (await getDatabase()).collection('coupons');
    if (req.method === 'PATCH') {
      const body = readBody(req);
      if (typeof body.active !== 'boolean') return send(res, 400, { error: 'Coupon active status must be boolean.' });
      const result = await coupons.updateOne({ code }, { $set: { active: body.active, updatedAt: new Date() } });
      if (!result.matchedCount) return send(res, 404, { error: 'Coupon not found.' });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      const result = await coupons.updateOne({ code }, { $set: { active: false, deletedAt: new Date(), updatedAt: new Date() } });
      if (!result.matchedCount) return send(res, 404, { error: 'Coupon not found.' });
      return send(res, 200, { ok: true });
    }
    return methodNotAllowed(res, ['PATCH', 'DELETE']);
  } catch (error) {
    return handleError(res, error);
  }
}
