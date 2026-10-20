'use strict';
const crypto = require('node:crypto');
const ZONES = ['Pacific/Auckland', 'Asia/Shanghai', 'Australia/Sydney', 'Europe/London', 'America/Los_Angeles', 'America/New_York', 'America/Vancouver'];
class Fault extends Error { constructor(code) { super(code); this.code = code; } }
function need(condition, code = 'INVALID_INPUT') { if (!condition) throw new Fault(code); }
function text(value, min, max) { need(typeof value === 'string'); const v = value.trim(); need(v.length >= min && v.length <= max && !/[\u0000-\u001f]/.test(v)); return v; }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function publicUser(u) { return { id: u._id, displayName: u.displayName, familyId: u.familyId }; }
function publicFamily(f) {
  return { id: f._id, name: f.name, timezone: f.timezone, members: f.members.map(m => ({ userId: m.userId, displayName: m.displayName, role: m.role, joinedAt: m.joinedAt })), createdAt: f.createdAt };
}
async function get(store, collection, id) {
  try {
    const r = await store.collection(collection).doc(id).get();
    const data = Array.isArray(r.data) ? r.data[0] : r.data;
    return data && data._id ? data : null;
  } catch (e) {
    // Only a missing document is optional; missing collections / access errors must fail.
    if (e.code === 'DATABASE_DOCUMENT_NOT_EXIST' || (e.errCode === -1 && /document.*(?:not exist|not found|不存在)/i.test(e.errMsg || e.message || ''))) return null;
    throw e;
  }
}
async function put(store, collection, id, data) { const { _id, ...fields } = data; await store.collection(collection).doc(id).set({ data: fields }); }
function activeMember(family, id) { need(family && !family.deletedAt, 'NO_FAMILY'); const m = family.members.find(m => m.userId === id); need(m, 'FORBIDDEN'); return m; }
async function membership(tx, id) {
  const user = await get(tx, 'users', id); need(user && user.familyId, 'NO_FAMILY');
  const family = await get(tx, 'families', user.familyId);
  const member = activeMember(family, id);
  return { user, family, member };
}
function makeService({ db, now = () => new Date(), random = n => crypto.randomBytes(n).toString('hex').toUpperCase() }) {
  async function transact(openid, fn) {
    need(typeof openid === 'string' && openid.length > 0, 'NO_IDENTITY');
    const id = hash('user:' + openid);
    return db.runTransaction(tx => fn(tx, id, now().toISOString()));
  }
  async function auth(openid, event) {
    need(event && ['login', 'updateProfile'].includes(event.action));
    return transact(openid, async (tx, id, at) => {
      let u = await get(tx, 'users', id);
      if (!u) {
        u = { _id: id, openid, familyId: null, displayName: '家人' + id.slice(0, 4), createdBy: id, createdAt: at, updatedAt: at };
      }
      let f = u.familyId ? await get(tx, 'families', u.familyId) : null;
      if (u.familyId) activeMember(f, id);
      if (event.action === 'updateProfile') {
        u.displayName = text(event.displayName, 1, 24); u.updatedAt = at;
        if (f) { f.members = f.members.map(m => m.userId === id ? { ...m, displayName: u.displayName } : m); f.updatedAt = at; await put(tx, 'families', f._id, f); }
      }
      await put(tx, 'users', id, u);
      return { user: publicUser(u), family: f ? publicFamily(f) : null };
    });
  }
  async function family(openid, event) {
    need(event && ['create', 'join', 'get', 'invite', 'revokeInvite', 'removeMember', 'leave', 'setRole', 'update'].includes(event.action));
    const code = ['join'].includes(event.action) ? text(event.code, 12, 12).toUpperCase() : null;
    if (code) need(/^[A-F0-9]{12}$/.test(code), 'INVITE_INVALID');
    // IDs/codes are generated once outside transaction callbacks (SDK may retry).
    const newId = event.action === 'create' ? 'f_' + random(16).toLowerCase() : null;
    const newCode = event.action === 'invite' ? random(6) : null;
    return transact(openid, async (tx, id, at) => {
      const u = await get(tx, 'users', id); need(u, 'NO_IDENTITY');
      if (event.action === 'create') {
        need(!u.familyId, 'ALREADY_IN_FAMILY');
        const name = text(event.name, 1, 40);
        const timezone = event.timezone === undefined ? 'Pacific/Auckland' : event.timezone; need(ZONES.includes(timezone));
        need(!await get(tx, 'families', newId), 'INTERNAL');
        const f = { _id: newId, familyId: newId, name, timezone, adminId: id, members: [{ userId: id, displayName: u.displayName, role: 'admin', joinedAt: at }], activeInviteId: null, lastInviteAt: null, inviteGeneration: 0, createdBy: id, createdAt: at, updatedAt: at, deletedAt: null };
        u.familyId = newId; u.updatedAt = at;
        await put(tx, 'families', newId, f); await put(tx, 'users', id, u);
        return { family: publicFamily(f) };
      }
      if (event.action === 'join') {
        need(!u.familyId, 'ALREADY_IN_FAMILY');
        const invitationId = hash('invite:' + code);
        const inv = await get(tx, 'invitations', invitationId);
        need(inv && !inv.usedAt && !inv.revokedAt && inv.expiresAt > at, 'INVITE_INVALID');
        const f = await get(tx, 'families', inv.familyId);
        need(f && !f.deletedAt && f.activeInviteId === invitationId && f.inviteGeneration === inv.generation && f.adminId === inv.createdBy, 'INVITE_INVALID');
        need(f.members.length < 3, 'FAMILY_FULL');
        need(!f.members.some(m => m.userId === id), 'ALREADY_IN_FAMILY');
        need(['parent', 'student'].includes(event.role));
        f.members.push({ userId: id, displayName: u.displayName, role: event.role, joinedAt: at });
        f.activeInviteId = null; f.updatedAt = at;
        inv.usedAt = at; inv.usedBy = id; inv.updatedAt = at;
        u.familyId = f._id; u.updatedAt = at;
        await put(tx, 'invitations', invitationId, inv); await put(tx, 'families', f._id, f); await put(tx, 'users', id, u);
        return { family: publicFamily(f) };
      }
      const { family: f, member } = await membership(tx, id);
      if (event.action === 'get') return { family: publicFamily(f) };
      if (event.action === 'leave') {
        need(member.role !== 'admin' || f.members.length === 1, 'ADMIN_LEAVE');
        f.members = f.members.filter(m => m.userId !== id);
        if (member.role === 'admin') { f.deletedAt = at; f.activeInviteId = null; f.inviteGeneration += 1; }
        f.updatedAt = at; u.familyId = null; u.updatedAt = at;
        await put(tx, 'families', f._id, f); await put(tx, 'users', id, u);
        return { left: true };
      }
      need(member.role === 'admin' && f.adminId === id, 'FORBIDDEN');
      if (event.action === 'invite') {
        need(f.members.length < 3, 'FAMILY_FULL');
        need(!f.lastInviteAt || Date.parse(at) - Date.parse(f.lastInviteAt) >= 30000, 'INVITE_THROTTLED');
        const inviteId = hash('invite:' + newCode);
        need(!await get(tx, 'invitations', inviteId), 'INTERNAL');
        f.inviteGeneration += 1;
        const expiresAt = new Date(Date.parse(at) + 24 * 60 * 60 * 1000).toISOString();
        const invitation = { _id: inviteId, familyId: f._id, generation: f.inviteGeneration, expiresAt, usedAt: null, usedBy: null, revokedAt: null, createdBy: id, createdAt: at, updatedAt: at };
        f.activeInviteId = inviteId; f.lastInviteAt = at; f.updatedAt = at;
        await put(tx, 'invitations', inviteId, invitation); await put(tx, 'families', f._id, f);
        return { code: newCode, expiresAt };
      }
      if (event.action === 'revokeInvite') { f.activeInviteId = null; f.inviteGeneration += 1; }
      if (event.action === 'update') { f.name = text(event.name, 1, 40); need(ZONES.includes(event.timezone)); f.timezone = event.timezone; }
      if (['removeMember', 'setRole'].includes(event.action)) {
        const targetId = text(event.userId, 64, 64);
        const target = f.members.find(m => m.userId === targetId);
        need(target && targetId !== f.adminId, 'FORBIDDEN');
        if (event.action === 'setRole') { need(['parent', 'student'].includes(event.role)); target.role = event.role; }
        else {
          const targetUser = await get(tx, 'users', targetId);
          need(targetUser && targetUser.familyId === f._id, 'FORBIDDEN');
          targetUser.familyId = null; targetUser.updatedAt = at;
          f.members = f.members.filter(m => m.userId !== targetId);
          await put(tx, 'users', targetId, targetUser);
          // Membership changes also invalidate any previously issued invitation.
          f.activeInviteId = null; f.inviteGeneration += 1;
        }
      }
      f.updatedAt = at; await put(tx, 'families', f._id, f);
      return { family: publicFamily(f) };
    });
  }
  return { auth, family };
}
function makeHandler(cloud, domain) {
  const service = makeService({ db: cloud.database({ throwOnNotFound: false }) });
  return async event => {
    try {
      const data = await service[domain](cloud.getWXContext().OPENID, event);
      return { ok: true, data };
    } catch (e) {
      // Never log OpenID, invitation codes, raw requests, credentials or database errors.
      return { ok: false, error: { code: e instanceof Fault ? e.code : 'INTERNAL' } };
    }
  };
}
module.exports = { makeService, makeHandler, Fault, hash, ZONES };
