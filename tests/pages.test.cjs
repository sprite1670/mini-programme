const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { formatTime } = require('../miniprogram/utils/time');
const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../miniprogram/app.json')));
test('four expected tabs and all phase-one pages are registered, with no share handlers', () => {
  assert.deepEqual(app.tabBar.list.map(t => t.pagePath), ['pages/index/index','pages/calendar/index','pages/tasks/index','pages/profile/index']);
  for (const page of app.pages) {
    const source = fs.readFileSync(path.join(__dirname, '../miniprogram', page + '.js'), 'utf8');
    assert.doesNotMatch(source, /onShareAppMessage|onShareTimeline/);
    assert.match(source, /securePage/);
  }
});
test('securePage disables public sharing before page load', () => {
  let page; let hidden; let loaded = false;
  const source = fs.readFileSync(path.join(__dirname, '../miniprogram/utils/page.js'), 'utf8');
  const context = { Page: p => { page = p; }, require: () => ({ call() {} }), module: { exports: {} }, wx: { hideShareMenu: p => { hidden = p; } } };
  vm.runInNewContext(source, context);
  context.module.exports.securePage({ onLoad() { loaded = true; } }); page.onLoad({});
  assert.deepEqual(Array.from(hidden.menus), ['shareAppMessage', 'shareTimeline']); assert.equal(loaded, true);
});
test('Beijing and Christchurch formatting respects daylight saving', () => {
  const summer = formatTime('2026-01-01T00:00:00Z', 'Pacific/Auckland');
  const winter = formatTime('2026-07-01T00:00:00Z', 'Pacific/Auckland');
  assert.match(summer, /13:00/); assert.match(winter, /12:00/);
  assert.match(formatTime('2026-01-01T00:00:00Z', 'Asia/Shanghai'), /08:00/);
});
test('client API refuses missing configuration and maps errors without leaking server data', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../miniprogram/services/api.js'), 'utf8');
  let ready = false; let request;
  const c = { module: { exports: {} }, getApp: () => ({ globalData: { cloudReady: ready } }), wx: { cloud: { callFunction: async p => { request = p; return { result: { ok: false, error: { code: 'FORBIDDEN', secret: 'hidden' } } }; } } } };
  vm.runInNewContext(source, c); const { call } = c.module.exports;
  await assert.rejects(() => call('family', 'get'), /云环境 ID/);
  ready = true; await assert.rejects(() => call('family', 'get', { action: 'delete' }), /没有此操作权限/); assert.equal(request.data.action, 'get');
});
