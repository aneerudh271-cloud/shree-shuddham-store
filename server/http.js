export function send(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(payload));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  send(res, 405, { error: 'Method not allowed.' });
}

export function readBody(req) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('A JSON request body is required.');
    error.status = 400;
    throw error;
  }
  return body;
}

export function requireString(value, label, maxLength = 160, required = true) {
  if (typeof value !== 'string') {
    if (!required && (value === undefined || value === null || value === '')) return '';
    const error = new Error(`${label} must be text.`);
    error.status = 400;
    throw error;
  }
  const result = value.trim();
  if (required && !result) {
    const error = new Error(`${label} is required.`);
    error.status = 400;
    throw error;
  }
  if (result.length > maxLength) {
    const error = new Error(`${label} must be no more than ${maxLength} characters.`);
    error.status = 400;
    throw error;
  }
  return result;
}

export function requireInteger(value, label, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    const error = new Error(`${label} must be a whole number from ${min} to ${max}.`);
    error.status = 400;
    throw error;
  }
  return number;
}

export function validateOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    const error = new Error('Invalid request origin.');
    error.status = 403;
    throw error;
  }
  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowedOrigins.length) {
    if (!allowedOrigins.includes(parsed.origin)) {
      const error = new Error('Cross-origin requests are not allowed.');
      error.status = 403;
      throw error;
    }
    return;
  }
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  if (!host || parsed.host.toLowerCase() !== host) {
    const error = new Error('Cross-origin requests are not allowed.');
    error.status = 403;
    throw error;
  }
}

export function handleError(res, error) {
  if (res.writableEnded) return;
  if (error.status && error.status < 500) {
    send(res, error.status, { error: error.message });
    return;
  }
  console.error('API request failed:', error);
  send(res, 500, { error: 'The request could not be completed.' });
}
