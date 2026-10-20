const { call } = require('../../services/api');
const { securePage, session, error, toast } = require('../../utils/page');
const { zones } = require('../../utils/time');
securePage({
  data: { loading: true, busy: false, error: '', family: null, admin: false, name: '', zoneIndex: 0, zoneLabels: zones.map(z => z.label) },
  async onShow() {
    this.setData({ loading: true, error: '', family: null, admin: false });
    try { const s = await session(); if (s && s.family) { const me = s.family.members.find(m => m.userId === s.user.id); this.setData({ family: s.family, admin: me.role === 'admin', name: s.family.name, zoneIndex: Math.max(0, zones.findIndex(z => z.value === s.family.timezone)) }); } }
    catch (e) { error(this, e); } finally { this.setData({ loading: false }); }
  },
  nameInput(e) { this.setData({ name: e.detail.value }); },
  zoneChange(e) { this.setData({ zoneIndex: Number(e.detail.value) }); },
  async save() {
    if (this.data.busy || !this.data.admin) return;
    this.setData({ busy: true, error: '' });
    try { const r = await call('family', 'update', { name: this.data.name, timezone: zones[this.data.zoneIndex].value }); this.setData({ family: r.family }); toast('设置已保存'); }
    catch (e) { error(this, e); } finally { this.setData({ busy: false }); }
  }
});
