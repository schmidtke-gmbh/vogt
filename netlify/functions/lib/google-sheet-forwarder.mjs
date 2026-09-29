const ALLOWED_FORMS = new Set(['probetraining', 'firmenanfrage', 'blitzbewerbung']);

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

function validateEndpoint(endpoint) {
  if (!endpoint) throw new Error('Missing Google Apps Script endpoint');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com') {
    throw new Error('Invalid Google Apps Script endpoint');
  }
  return url.toString();
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidNetlifyId(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function isValidIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 23
    && offsetMinute <= 59
    && !Number.isNaN(Date.parse(value));
}

export function parseSubmission(rawBody) {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody || '{}') : rawBody;
  if (!isPlainObject(body)) throw new Error('Invalid Netlify submission');

  const payload = Object.hasOwn(body, 'payload') ? body.payload : body;
  if (!isPlainObject(payload)) throw new Error('Invalid Netlify submission');

  const formName = payload.form_name ?? payload.formName ?? payload.data?.['form-name'];
  if (!ALLOWED_FORMS.has(formName)) return null;

  const submissionId = payload.id ?? payload.submission_id;
  const createdAt = payload.created_at ?? payload.createdAt;
  if (!isValidNetlifyId(submissionId) || !isPlainObject(payload.data) || !isValidIsoTimestamp(createdAt)) {
    throw new Error('Invalid Netlify submission');
  }

  return payload;
}

async function sendToAppsScript(fetchImpl, endpointUrl, submission, signal) {
  const initial = await fetchImpl(endpointUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(submission),
    redirect: 'manual',
    signal,
  });

  if (![302, 303].includes(initial.status)) return initial;

  const location = initial.headers.get('location');
  if (!location) throw new Error('Apps Script redirect is missing');
  const redirectUrl = new URL(location, endpointUrl);
  if (redirectUrl.protocol !== 'https:' || redirectUrl.hostname !== 'script.googleusercontent.com') {
    throw new Error('Apps Script redirect is not allowed');
  }

  return fetchImpl(redirectUrl.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal,
  });
}

export function buildSubmissionHandler({ endpoint, fetchImpl = fetch, timeoutMs = 10_000 }) {
  let endpointUrl;
  try {
    endpointUrl = validateEndpoint(endpoint);
  } catch (error) {
    endpointUrl = null;
  }

  return async function handler(event) {
    if (!endpointUrl) return response(500, { ok: false, error: 'Integration is not configured' });

    let submission;
    try {
      submission = parseSubmission(event?.body ?? '{}');
    } catch {
      return response(400, { ok: false, error: 'Invalid submission payload' });
    }

    if (!submission) return response(200, { ok: true, ignored: true });

    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const upstream = await sendToAppsScript(fetchImpl, endpointUrl, submission, signal);

      if (!upstream.ok) {
        console.error('Google Sheet forwarding failed with HTTP status', upstream.status);
        return response(502, { ok: false, error: 'Google Sheet forwarding failed' });
      }

      let result;
      try {
        result = await upstream.json();
      } catch {
        console.error('Google Sheet forwarding returned invalid JSON');
        return response(502, { ok: false, error: 'Google Sheet forwarding failed' });
      }

      if (result?.ok !== true) {
        console.error('Google Sheet forwarding was rejected by Apps Script');
        return response(502, { ok: false, error: 'Google Sheet forwarding failed' });
      }

      return response(200, { ok: true });
    } catch (error) {
      console.error('Google Sheet forwarding request failed', error?.name ?? 'Error');
      return response(502, { ok: false, error: 'Google Sheet forwarding failed' });
    }
  };
}
