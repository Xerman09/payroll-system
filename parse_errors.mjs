import fs from 'fs';
const text = fs.readFileSync('lint_errors_only.txt', 'utf8');
const lines = text.split(/\r?\n/);
const files = lines.filter(l => l.startsWith('C:\\'));
const unique = [...new Set(files)];
console.log(`Total files with true ERRORS: ${unique.length}`);
console.log('Top 10 files with errors:');
console.log(unique.slice(0, 10).join('\n'));
