import { readAdminSession } from '../../server/auth.js';
import { handleError, methodNotAllowed } from '../../server/http.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    return await readAdminSession(req, res);
  } catch (error) {
    return handleError(res, error);
  }
}
