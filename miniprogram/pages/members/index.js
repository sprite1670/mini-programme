const { call } = require('../../services/api');
const { securePage, session, error, toast, confirm } = require('../../utils/page');
securePage({
  data: { loading: true, busy: false, error: '', family: null, userId: '', admin: false, code: '', expiresAt: '' },
  onShow() { this.refresh(); },
  onHide() { this.setData({ code: '', expiresAt: '' }); },
  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()); },
  async refresh() {
    this.setData({ loading: true, error: '', family: null, admin: false });
    try {
      const s = await session();
      if (s && s.family) { const m = s.family.members.find(m => m.userId === s.user.id); this.setData({ family: s.family, userId: s.user.id, admin: m.role === 'admin' }); }
    } catch (e) { error(this, e); } finally { this.setData({ loading: false }); }
  },
  async act(action, data) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const result = await call('family', action, data);
      if (action === 'invite') this.setData({ code: result.code, expiresAt: result.expiresAt });
      else { this.setData({ code: '', expiresAt: '' }); toast('操作已完成'); await this.refresh(); }
      return true;
    } catch (e) { error(this, e); return false; } finally { this.setData({ busy: false }); }
  },
  invite() { return this.act('invite'); },
  revoke() { return this.act('revokeInvite'); },
  copyCode() { if (this.data.code) wx.setClipboardData({ data: this.data.code }); },
  async remove(e) { if (await confirm('移除该成员后，对方将无法再访问本家庭。确认移除？')) return this.act('removeMember', { userId: e.currentTarget.dataset.id }); },
  changeRole(e) { return this.act('setRole', { userId: e.currentTarget.dataset.id, role: e.currentTarget.dataset.role }); },
  async leave() { if (await confirm('退出后将无法访问家庭内容。管理员仅能在其他成员全部退出后归档家庭。确认继续？')) { if (await this.act('leave')) wx.switchTab({ url: '/pages/index/index' }); } }
});
