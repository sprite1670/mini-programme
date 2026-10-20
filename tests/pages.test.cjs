const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function loadPage(name) {
  let page;
  const calls = [];
  const context = {
    App: app => { context.app = app; },
    Page: definition => { page = definition; },
    getApp: () => context.app,
    wx: { switchTab: args => calls.push(['switchTab', args]), showModal: args => calls.push(['showModal', args]) }
  };
  vm.createContext(context);
  const root = path.join(__dirname, '../miniprogram');
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, `pages/${name}/${name}.js`), 'utf8'), context);
  page.setData = data => Object.assign(page.data, data);
  return { page, calls };
}
test('home counter accumulates repeated taps', () => {
  const { page } = loadPage('home');
  assert.equal(page.data.count, 0);
  page.increment(); page.increment();
  assert.equal(page.data.count, 2);
});
test('home opens the registered profile tab', () => {
  const { page, calls } = loadPage('home');
  page.openProfile();
  assert.equal(calls[0][0], 'switchTab');
  assert.equal(calls[0][1].url, '/pages/profile/profile');
});
for (const name of ['home', 'profile']) {
  test(`${name} shares an existing home route`, () => {
    const { page } = loadPage(name);
    const share = page.onShareAppMessage();
    assert.ok(share.title.length > 0);
    assert.equal(share.path, '/pages/home/home');
    const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../miniprogram/app.json')));
    assert.ok(app.pages.includes(share.path.slice(1)));
    const wxml = fs.readFileSync(path.join(__dirname, `../miniprogram/pages/${name}/${name}.wxml`), 'utf8');
    assert.match(wxml, /open-type="share"/);
  });
}
test('profile uses application version and shows about dialog', () => {
  const { page, calls } = loadPage('profile');
  assert.equal(page.data.version, '0.1.0');
  page.showAbout();
  assert.equal(calls[0][0], 'showModal');
  assert.equal(calls[0][1].showCancel, false);
  assert.match(calls[0][1].content, /第一步/);
});
