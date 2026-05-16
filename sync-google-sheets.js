require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ─── Safety threshold ────────────────────────────────────────────────────────
// If the Sheet returns fewer than this many keys it is considered incomplete.
// Update this number if you intentionally reduce the key set.
const MIN_EXPECTED_KEYS = 20;
// ─────────────────────────────────────────────────────────────────────────────

const uiStringsPath = path.join(__dirname, 'ui-strings.json');

async function syncTranslations() {
  // Load the repo backup before touching anything
  const localData = JSON.parse(fs.readFileSync(uiStringsPath, 'utf8'));
  const localKeyCount = Object.keys(localData).length;

  // Auth — write scope only needed for seeding; kept here so one service
  // account handles both directions without a separate credential.
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:E',
    });

    const rows = response.data.values || [];
    // Data rows = total rows minus the header row
    const sheetKeyCount = Math.max(0, rows.length - 1);

    // ── Decision tree ────────────────────────────────────────────────────────

    if (sheetKeyCount === 0) {
      // Sheet is completely empty — seed it from the repo backup
      console.log('⚠️  Sheet is empty. Seeding from repo ui-strings.json…');
      await seedSheet(sheets, spreadsheetId, localData);
      console.log(`✅ Seeded ${localKeyCount} keys to Google Sheets. Build will use repo backup.`);
      // Don't overwrite ui-strings.json — the local file is already correct
      return;
    }

    if (sheetKeyCount < MIN_EXPECTED_KEYS) {
      // Sheet has some data but suspiciously few keys — looks like an accident.
      // Fall back to the repo backup rather than overwriting with bad data.
      console.warn(
        `⚠️  Sheet only has ${sheetKeyCount} keys (expected ≥ ${MIN_EXPECTED_KEYS}). ` +
        `Looks incomplete — building from repo backup instead. Live site is safe.`
      );
      // No write to ui-strings.json; build continues with existing file
      return;
    }

    // Sheet looks healthy — pull it down and overwrite the local file
    await pullFromSheet(rows, uiStringsPath);

  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    console.warn('⚠️  Falling back to existing ui-strings.json for this build.');
    // Don't exit(1) — let the build succeed using the repo backup
  }
}

// ── Seed: push the repo backup up to an empty Sheet ─────────────────────────
async function seedSheet(sheets, spreadsheetId, jsonData) {
  const headers = ['Key', 'en', 'fr', 'ar', 'hy'];
  const rows = [headers];

  Object.keys(jsonData).forEach(key => {
    rows.push([
      key,
      jsonData[key].en || '',
      jsonData[key].fr || '',
      jsonData[key].ar || '',
      jsonData[key].hy || '',
    ]);
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    resource: { values: rows },
  });

  console.log(`✅ Pushed ${rows.length - 1} keys to Google Sheets.`);
}

// ── Pull: overwrite local ui-strings.json from a healthy Sheet ───────────────
async function pullFromSheet(rows, filePath) {
  const headers = rows[0]; // ['Key', 'en', 'fr', 'ar', 'hy']
  const jsonData = {};

  rows.slice(1).forEach(row => {
    const key = row[0];
    if (!key) return;
    jsonData[key] = {};
    headers.slice(1).forEach((lang, index) => {
      jsonData[key][lang] = row[index + 1] || '';
    });
  });

  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
  console.log(`✅ ui-strings.json updated from Google Sheets (${Object.keys(jsonData).length} keys).`);
}

syncTranslations();
