import { getDatabase } from '../../server/db.js';
import { requireAdmin } from '../../server/auth.js';
import { handleError, methodNotAllowed, readBody, requireString, send, validateOrigin } from '../../server/http.js';

function validatePin(value) {
  const pin = requireString(value, 'PIN code', 6);
  if (!/^\d{6}$/.test(pin)) {
    const error = new Error('PIN code must contain exactly 6 digits.');
    error.status = 400;
    throw error;
  }
  return pin;
}

export default async function handler(req, res) {
  try {
    const pincodes = (await getDatabase()).collection('pincodes');
    if (req.method === 'GET') {
      if (req.query.includeInactive === 'true') {
        if (!await requireAdmin(req, res)) return;
        const rows = await pincodes.find({}, { projection: { _id: 0 } }).sort({ pin: 1 }).toArray();
        return send(res, 200, { pincodes: rows });
      }
      if (req.query.pin !== undefined) {
        const pin = validatePin(String(req.query.pin));
        const serviceable = Boolean(await pincodes.findOne({ pin, active: true }, { projection: { _id: 1 } }));
        return send(res, 200, { serviceable });
      }
      const rows = await pincodes.find({ active: true }, { projection: { _id: 0, pin: 1 } }).sort({ pin: 1 }).toArray();
      return send(res, 200, { pincodes: rows });
    }
    if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    validateOrigin(req);
    if (!await requireAdmin(req, res)) return;
    const body = readBody(req);
    const pin = validatePin(body.pin);
    const record = {
      pin,
      label: requireString(body.label || '', 'Area label', 100, false),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    try {
      await pincodes.insertOne(record);
    } catch (error) {
      if (error.code === 11000) return send(res, 409, { error: 'That PIN code is already on the service-area list.' });
      throw error;
    }
    return send(res, 201, { pincode: record });
  } catch (error) {
    return handleError(res, error);
  }
}
