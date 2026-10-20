const { call } = require('../../services/api');
const { securePage, session, error } = require('../../utils/page');
const { formatTime } = require('../../utils/time');
securePage({
  data: { loading: false, error: '', signedIn: false, family: null, beijing: '', localTime: '' },
  onShow() { this.refresh(); this.tick(); clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 60000); },
  onHide() { clearInterval(this.timer); },
  onUnload() { clearInterval(this.timer); },
  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()); },
  tick() {
    const at = new Date().toISOString();
    this.setData({ beijing: formatTime(at, 'Asia/Shanghai'), localTime: formatTime(at, (this.data.family && this.data.family.timezone) || 'Pacific/Auckland') });
  },
  async login() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      const data = await call('auth', 'login');
      getApp().globalData.signedIn = true;
      this.setData({ signedIn: true, family: data.family }); this.tick();
    } catch (e) { error(this, e); } finally { this.setData({ loading: false }); }
  },
  async refresh() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '', family: null, signedIn: !!getApp().globalData.signedIn });
    try { const data = await session(); this.setData({ family: data ? data.family : null }); this.tick(); }
    catch (e) { error(this, e); } finally { this.setData({ loading: false }); }
  },
  openFamily() { wx.navigateTo({ url: '/pages/family/index' }); },
  openMembers() { wx.navigateTo({ url: '/pages/members/index' }); },
  upcoming() { wx.showToast({ title: '第三阶段开放，当前无资料录入', icon: 'none' }); }
});
