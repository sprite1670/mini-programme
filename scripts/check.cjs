const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
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
console.log(`Project structure and JavaScript syntax passed: ${app.pages.length} pages.`);
