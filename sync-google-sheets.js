require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function syncTranslations() {
  // 1. Auth setup using the Environment Variable from Netlify
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:E', // Adjust based on your columns (Key, EN, FR, AR, HY)
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) throw new Error('No data found in sheet.');

    // 2. Transform Rows back into our JSON structure
    const headers = rows[0]; // [Key, en, fr, ar, hy]
    const jsonData = {};

    rows.slice(1).forEach(row => {
      const key = row[0];
      jsonData[key] = {};
      headers.slice(1).forEach((lang, index) => {
        jsonData[key][lang] = row[index + 1] || "";
      });
    });

    // 3. Overwrite local source of truth for the build
    fs.writeFileSync(
      path.join(__dirname, 'ui-strings.json'), 
      JSON.stringify(jsonData, null, 2)
    );
    console.log('✅ Local ui-strings.json updated from Google Sheets.');
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1); // Force build failure if sync fails
  }
}

syncTranslations();