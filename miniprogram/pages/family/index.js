const { call } = require('../../services/api');
const { securePage, session, error, toast } = require('../../utils/page');
const { zones } = require('../../utils/time');
securePage({
  data: { name: '', code: '', roleIndex: 0, roles: ['家长', '学生'], zoneIndex: 0, zoneLabels: zones.map(z => z.label), busy: false, loading: true, error: '', ready: false, bound: false },
  async onShow() {
    this.setData({ loading: true, error: '', ready: false });
    try { const s = await session(); this.setData({ ready: !!s, bound: !!(s && s.family) }); }
    catch (e) { error(this, e); } finally { this.setData({ loading: false }); }
  },
  nameInput(e) { this.setData({ name: e.detail.value }); },
  codeInput(e) { this.setData({ code: e.detail.value.trim().toUpperCase() }); },
  zoneChange(e) { this.setData({ zoneIndex: Number(e.detail.value) }); },
  roleChange(e) { this.setData({ roleIndex: Number(e.detail.value) }); },
  async create() { return this.submit('create', { name: this.data.name, timezone: zones[this.data.zoneIndex].value }); },
  async join() { return this.submit('join', { code: this.data.code, role: this.data.roleIndex === 0 ? 'parent' : 'student' }); },
  async submit(action, data) {
    if (this.data.busy || !this.data.ready || this.data.bound) return;
    this.setData({ busy: true, error: '' });
    try { await call('family', action, data); this.setData({ bound: true, code: '' }); toast(action === 'create' ? '家庭已创建' : '已加入家庭'); wx.switchTab({ url: '/pages/index/index' }); }
    catch (e) { error(this, e); } finally { this.setData({ busy: false }); }
  }
});
