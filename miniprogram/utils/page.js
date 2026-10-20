const { call } = require('../services/api');
function securePage(definition) {
  const onLoad = definition.onLoad;
  definition.onLoad = function (options) {
    wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    if (onLoad) onLoad.call(this, options);
  };
  Page(definition);
}
async function session() {
  if (!getApp().globalData.signedIn) return null;
  return call('auth', 'login');
}
function error(page, err) { page.setData({ error: err.message || '操作失败，请重试' }); }
function toast(title) { wx.showToast({ title, icon: 'success' }); }
function confirm(content) { return new Promise(resolve => wx.showModal({ title: '请确认', content, success: r => resolve(r.confirm), fail: () => resolve(false) })); }
module.exports = { securePage, session, error, toast, confirm };
