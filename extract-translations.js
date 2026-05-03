const fs = require('fs');
const path = require('path');

// 1. Configuration
const INPUT_FILE = path.join(__dirname, 'ui-strings.json');
const OUTPUT_FILE = path.join(__dirname, 'master_translations.csv');

// 2. Load Data
if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Error: ${INPUT_FILE} not found.`);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const keys = Object.keys(data);
// Dynamically get languages from the first key (e.g., en, fr, ar, hy)
const langs = Object.keys(data[keys[0]] || {});

// 3. Build CSV Content
// BOM (Byte Order Mark) ensures Excel opens UTF-8 (Arabic/Armenian) correctly
let csvContent = '\ufeff'; 
csvContent += ['Key', ...langs].join(',') + '\n';

keys.forEach(key => {
    const row = [key];
    langs.forEach(lang => {
        // Escape quotes and wrap in quotes to handle commas in text
        let text = data[key][lang] || '';
        text = text.replace(/"/g, '""'); 
        row.push(`"${text}"`);
    });
    csvContent += row.join(',') + '\n';
});

// 4. Write to File
fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf8');

console.log(`✅ Success! ${keys.length} strings extracted to ${OUTPUT_FILE}`);
console.log(`Languages found: ${langs.join(', ')}`);