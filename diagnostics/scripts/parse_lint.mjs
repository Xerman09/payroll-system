import fs from 'fs';
const text = fs.readFileSync('lint_results.txt', 'utf8');
const lines = text.split('\n');
const files = lines.filter(l => l.startsWith('C:\\'));
const unique = [...new Set(files)];
console.log('Total files:', unique.length);
console.log(unique.slice(0, 15).join('\n'));
