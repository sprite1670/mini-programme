const { call } = require('../../services/api');
const { securePage, session, error, toast } = require('../../utils/page');
securePage({
  data: { loading: false, busy: false, error: '', user: null, family: null, displayName: '', version: '' },
  onShow() { this.refresh(); },
  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()); },
  async refresh() {
    this.setData({ loading: true, error: '', user: null, family: null, version: getApp().globalData.version });
    try { const s = await session(); if (s) this.setData({ user: s.user, family: s.family, displayName: s.user.displayName }); }
    catch (e) { error(this, e); } finally { this.setData({ loading: false }); }
  },
  nameInput(e) { this.setData({ displayName: e.detail.value }); },
  async save() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { const s = await call('auth', 'updateProfile', { displayName: this.data.displayName }); this.setData({ user: s.user, family: s.family }); toast('称呼已保存'); }
    catch (e) { error(this, e); } finally { this.setData({ busy: false }); }
  },
  openFamily() { wx.navigateTo({ url: '/pages/family/index' }); },
  openMembers() { wx.navigateTo({ url: '/pages/members/index' }); },
  openSettings() { wx.navigateTo({ url: '/pages/settings/index' }); },
  logout() { getApp().globalData.signedIn = false; this.setData({ user: null, family: null, displayName: '' }); toast('已退出本机登录'); wx.switchTab({ url: '/pages/index/index' }); }
});
