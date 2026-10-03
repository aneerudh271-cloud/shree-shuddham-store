import { getDatabase } from '../server/db.js';
import { handleError, methodNotAllowed, send } from '../server/http.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const db = await getDatabase();
    await db.command({ ping: 1 });
    return send(res, 200, { ok: true, database: 'connected' }, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return handleError(res, error);
  }
}
