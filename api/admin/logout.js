import { logoutAdmin } from '../../server/auth.js';
import { handleError, methodNotAllowed } from '../../server/http.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    return await logoutAdmin(req, res);
  } catch (error) {
    return handleError(res, error);
  }
}
