import fs from 'fs';
const text = fs.readFileSync('lint_results_2.txt', 'utf8');
const lines = text.split(/\r?\n/);
const files = lines.filter(l => l.startsWith('C:\\'));
const unique = [...new Set(files)];
console.log(`Total files with errors: ${unique.length}`);
console.log('Next 15 files:');
console.log(unique.slice(0, 15).join('\n'));
