import { google, type sheets_v4 } from 'googleapis';

import type { AppEnv } from '../../config/index.js';

const SHEETS_READ_WRITE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export function createGoogleSheetsClient(env: AppEnv): sheets_v4.Sheets {
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: [SHEETS_READ_WRITE_SCOPE]
  });

  return google.sheets({
    version: 'v4',
    auth
  });
}
