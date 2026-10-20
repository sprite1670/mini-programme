const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'cloudfunctions/_shared/service.js'), 'utf8');
for (const fn of ['auth', 'family']) {
  const file = path.join(root, 'cloudfunctions', fn, 'lib/service.js');
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== source) throw new Error(`Run npm run cloud:prepare: stale ${fn}/lib/service.js`);
  } else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, source); }
}
console.log('Cloud function shared code is synchronized.');
