require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function syncTranslations() {
  const uiStringsPath = path.join(__dirname, 'ui-strings.json');
  const localData = JSON.parse(fs.readFileSync(uiStringsPath, 'utf8'));

  // 1. Auth setup - UPGRADED SCOPE to allow writing
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'], 
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  try {
    // 2. Fetch current sheet data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:E',
    });

    const rows = response.data.values || [];

    // 3. Logic Gate: PUSH if sheet is empty, PULL if it has data
    if (rows.length <= 1) {
      console.log('⚠️ Sheet appears empty. Initiating SEED process...');
      await seedSheet(sheets, spreadsheetId, localData);
    } else {
      await pullFromSheet(rows, uiStringsPath);
    }

  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
}

async function seedSheet(sheets, spreadsheetId, jsonData) {
  const headers = ['Key', 'en', 'fr', 'ar', 'hy'];
  const rows = [headers];

  // Map every local key from your ui-strings.json
  Object.keys(jsonData).forEach(key => {
    rows.push([
      key,
      jsonData[key].en || "",
      jsonData[key].fr || "",
      jsonData[key].ar || "",
      jsonData[key].hy || ""
    ]);
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    resource: { values: rows },
  });
  console.log(`✅ Success: ${rows.length - 1} keys pushed to Google Sheets.`);
}

async function pullFromSheet(rows, uiStringsPath) {
  const headers = rows[0];
  const jsonData = {};

  rows.slice(1).forEach(row => {
    const key = row[0];
    if (!key) return;
    jsonData[key] = {};
    headers.slice(1).forEach((lang, index) => {
      jsonData[key][lang] = row[index + 1] || "";
    });
  });

  fs.writeFileSync(uiStringsPath, JSON.stringify(jsonData, null, 2));
  console.log('✅ Local ui-strings.json updated from Google Sheets.');
}

syncTranslations();