import { getDatabase } from '../../server/db.js';
import { requireAdmin } from '../../server/auth.js';
import { handleError, methodNotAllowed, readBody, send, validateOrigin } from '../../server/http.js';

export default async function handler(req, res) {
  try {
    validateOrigin(req);
    if (!await requireAdmin(req, res)) return;
    const pin = String(req.query.pin || '');
    if (!/^\d{6}$/.test(pin)) return send(res, 400, { error: 'Invalid PIN code.' });
    const pincodes = (await getDatabase()).collection('pincodes');
    if (req.method === 'PATCH') {
      const body = readBody(req);
      if (typeof body.active !== 'boolean') return send(res, 400, { error: 'PIN code status must be active or inactive.' });
      const result = await pincodes.updateOne({ pin }, { $set: { active: body.active, updatedAt: new Date() } });
      if (!result.matchedCount) return send(res, 404, { error: 'PIN code not found.' });
      return send(res, 200, { pincode: await pincodes.findOne({ pin }, { projection: { _id: 0 } }) });
    }
    if (req.method === 'DELETE') {
      const result = await pincodes.deleteOne({ pin });
      if (!result.deletedCount) return send(res, 404, { error: 'PIN code not found.' });
      return send(res, 200, { ok: true });
    }
    return methodNotAllowed(res, ['PATCH', 'DELETE']);
  } catch (error) {
    return handleError(res, error);
  }
}
