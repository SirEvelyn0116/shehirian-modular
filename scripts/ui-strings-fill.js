// Fills gaps in the UI strings pulled from the Google Sheet with the last
// committed copy (ui-strings.json), one string at a time, so a deleted row
// or a blank cell in the Sheet never reaches the live site as a missing
// label. Everything the Sheet does have is kept as-is. Used by
// sync-google-sheets.js; kept free of side effects so it can be unit-tested.
const LANGS = ['en', 'fr', 'ar', 'hy'];

const blank = (value) => typeof value !== 'string' || value.trim() === '';

// sheet, backup: { key: { en, fr, ar, hy } }
// Returns the merged strings plus what was filled and what could not be.
function fillMissingStrings(sheet, backup) {
  const merged = {};
  const filled = []; // { key, lang } taken from the backup
  const unfillable = []; // { key, lang } blank in the Sheet and absent from the backup

  const keys = [...new Set([...Object.keys(sheet), ...Object.keys(backup)])];
  for (const key of keys) {
    const fromSheet = sheet[key] || {};
    const fromBackup = backup[key] || {};
    merged[key] = { ...fromSheet };
    for (const lang of LANGS) {
      if (!blank(fromSheet[lang])) continue;
      if (!blank(fromBackup[lang])) {
        merged[key][lang] = fromBackup[lang];
        filled.push({ key, lang });
      } else {
        merged[key][lang] = fromSheet[lang] || '';
        unfillable.push({ key, lang });
      }
    }
  }
  return { merged, filled, unfillable };
}

module.exports = { fillMissingStrings, LANGS };
