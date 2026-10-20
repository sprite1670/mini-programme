const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { checkExpressions } = require('./wxml-expressions.cjs');
const root = path.resolve(__dirname, '..');
function json(file) { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
const project = json('project.config.json');
const base = project.miniprogramRoot;
const app = json(base + 'app.json');
assert.equal(project.compileType, 'miniprogram');
assert.ok(app.pages.length > 0);
for (const page of app.pages) {
  assert.ok(!page.includes('..') && !path.isAbsolute(page));
  for (const ext of ['js', 'json', 'wxml', 'wxss']) {
    assert.ok(fs.existsSync(path.join(root, base, page + '.' + ext)), `Missing ${page}.${ext}`);
  }
  json(base + page + '.json');
  new vm.Script(fs.readFileSync(path.join(root, base, page + '.js'), 'utf8'), { filename: page });
}
for (const tab of app.tabBar.list) assert.ok(app.pages.includes(tab.pagePath), `Invalid tab ${tab.pagePath}`);
new vm.Script(fs.readFileSync(path.join(root, base, 'app.js'), 'utf8'));
json(base + app.sitemapLocation);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'artifacts'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|cjs)$/.test(file)) new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
    else if (entry.name.endsWith('.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
  }
}
walk(root);
for (const page of app.pages) {
  const source = fs.readFileSync(path.join(root, base, page + '.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, base, page + '.wxml'), 'utf8');
  checkExpressions(template, page + '.wxml');
  for (const match of template.matchAll(/(?:bind|catch)(?::)?[a-z]+="([A-Za-z][A-Za-z0-9]*)"/g)) {
    assert.ok(new RegExp('\\b' + match[1] + '\\s*\\(').test(source), `Missing handler ${page}: ${match[1]}`);
  }
  for (const match of template.matchAll(/wx:(?:if|elif|for)="([^"]+)"/g)) assert.ok(match[1].startsWith('{{') && match[1].endsWith('}}'), `Missing WXML expression braces: ${page}`);
  assert.ok(!/open-type="share"/.test(template), 'Family pages must not expose public sharing');
}
console.log(`Project structure and JavaScript syntax passed: ${app.pages.length} pages.`);
