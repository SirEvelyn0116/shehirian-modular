const https = require('https');
const { google } = require('googleapis');
const { requireRole } = require('./_shared/requireRole');

// Fetch the live ui-strings.json from the deployed site
function fetchLiveStrings(siteUrl) {
  return new Promise((resolve, reject) => {
    const url = `${siteUrl}/ui-strings.json?t=${Date.now()}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Could not parse live ui-strings.json')); }
      });
    }).on('error', reject);
  });
}

// Pull current Sheet data using the service account
async function fetchSheetStrings() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Sheet1!A:E',
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) throw new Error('No data found in sheet.');

  const headers = rows[0]; // [Key, en, fr, ar, hy]
  const result = {};

  rows.slice(1).forEach(row => {
    const key = row[0];
    if (!key) return;
    result[key] = {};
    headers.slice(1).forEach((lang, index) => {
      result[key][lang] = row[index + 1] || '';
    });
  });

  return result;
}

// Diff the two objects: returns all keys with a `changed` flag and per-lang old/new values
function buildDiff(live, sheet) {
  const langs = ['en', 'fr', 'ar', 'hy'];
  const allKeys = new Set([...Object.keys(live), ...Object.keys(sheet)]);
  const rows = [];
  let totalChanges = 0;
  const changesByLang = { en: 0, fr: 0, ar: 0, hy: 0 };

  allKeys.forEach(key => {
    const liveEntry = live[key] || {};
    const sheetEntry = sheet[key] || {};
    const langDiffs = {};
    let keyChanged = false;

    langs.forEach(lang => {
      const oldVal = liveEntry[lang] || '';
      const newVal = sheetEntry[lang] || '';
      const changed = oldVal !== newVal;
      langDiffs[lang] = { old: oldVal, new: newVal, changed };
      if (changed) {
        keyChanged = true;
        totalChanges++;
        changesByLang[lang]++;
      }
    });

    const isNew = !live[key];
    const isDeleted = !sheet[key];

    rows.push({
      key,
      changed: keyChanged,
      isNew,
      isDeleted,
      langs: langDiffs,
    });
  });

  // Sort: changed keys first, then alphabetical
  rows.sort((a, b) => {
    if (a.changed && !b.changed) return -1;
    if (!a.changed && b.changed) return 1;
    return a.key.localeCompare(b.key);
  });

  return { rows, totalChanges, changesByLang };
}

exports.handler = async (event, context) => {
  // Role gate — shared with trigger-sync.js
  const gate = requireRole('translator', context);
  if (!gate.ok) {
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
  }

  try {
    const siteUrl = process.env.SITE_URL || 'https://your-site.netlify.app';
    const [live, sheet] = await Promise.all([
      fetchLiveStrings(siteUrl),
      fetchSheetStrings(),
    ]);

    const diff = buildDiff(live, sheet);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diff),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
