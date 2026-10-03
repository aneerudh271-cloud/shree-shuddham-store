import { createAdminSession } from '../../server/auth.js';
import { handleError, methodNotAllowed, readBody, requireString } from '../../server/http.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const body = readBody(req);
    const username = requireString(body.username, 'Admin ID', 80);
    const password = requireString(body.password, 'Password', 256);
    return await createAdminSession(req, res, username, password);
  } catch (error) {
    return handleError(res, error);
  }
}
