import { buildSubmissionHandler } from './lib/google-sheet-forwarder.mjs';

export const handler = buildSubmissionHandler({
  endpoint: process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL,
});
