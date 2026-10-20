const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkExpressions } = require('../scripts/wxml-expressions.cjs');

test('escaped HTML logical operators are rejected with template location', () => {
  assert.throws(() => checkExpressions('<view>\n<view wx:if="{{!loading &amp;&amp; !ready}}" />\n</view>', 'family.wxml'), /family\.wxml:2/);
});
test('WXML logical operators and ternary expressions parse as JavaScript', () => {
  assert.equal(checkExpressions('<view wx:if="{{!loading && !ready}}">{{family ? family.name : "未加入"}}</view>', 'page.wxml'), 2);
});
test('checker parses expressions without executing them', () => {
  assert.equal(checkExpressions('<view>{{unknownFunction()}}</view>', 'page.wxml'), 1);
});
test('all registered pages have valid interpolation and conditional expressions', () => {
  const root = path.join(__dirname, '../miniprogram');
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  let total = 0;
  for (const page of app.pages) {
    total += checkExpressions(fs.readFileSync(path.join(root, page + '.wxml'), 'utf8'), page + '.wxml');
  }
  assert.ok(total > 0);
});
