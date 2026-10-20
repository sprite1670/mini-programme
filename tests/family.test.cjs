const test = require('node:test');
const assert = require('node:assert/strict');
const { makeService, makeHandler, hash } = require('../cloudfunctions/_shared/service');
const { MemoryDB } = require('./helpers.cjs');
function fixture() {
  const db = new MemoryDB();
  let clock = Date.parse('2026-10-20T00:00:00.000Z');
  const service = makeService({ db, now: () => new Date(clock) });
  return { db, ...service, advance(ms) { clock += ms; } };
}
async function setup() {
  const f = fixture();
  for (const who of ['admin', 'parent', 'student', 'outsider']) await f.auth(who, { action: 'login' });
  const { family } = await f.family('admin', { action: 'create', name: '留学小家' });
  return { ...f, familyId: family.id };
}
async function join(f, who, role = 'parent') {
  const { code } = await f.family('admin', { action: 'invite' });
  return f.family(who, { action: 'join', code, role });
}
const rejects = (fn, code) => assert.rejects(fn, err => err.code === code);
test('login is idempotent, does not expose OpenID, ignores forged identity', async () => {
  const f = fixture();
  const a = await f.auth('alice', { action: 'login', openid: 'bob', familyId: 'fake', role: 'admin' });
  const b = await f.auth('alice', { action: 'login' });
  assert.deepEqual(a, b); assert.equal(a.user.familyId, null); assert.equal(a.user.id, hash('user:alice'));
  assert.equal(a.user.openid, undefined); assert.equal(Object.keys(f.db.records.users).length, 1);
});
test('identity and field validation reject malformed writes', async () => {
  const f = fixture();
  await rejects(() => f.auth('', { action: 'login' }), 'NO_IDENTITY');
  await f.auth('a', { action: 'login' });
  await rejects(() => f.auth('a', { action: 'updateProfile', displayName: {} }), 'INVALID_INPUT');
  await rejects(() => f.family('a', { action: 'create', name: ' ' }), 'INVALID_INPUT');
  await rejects(() => f.family('a', { action: 'create', name: '家', timezone: 'fake/zone' }), 'INVALID_INPUT');
  await rejects(() => f.family('a', { action: 'join', code: 'bad', role: 'admin' }), 'INVALID_INPUT');
  assert.equal(f.db.records.families, undefined);
});
test('creator is admin, family defaults to Christchurch, untrusted fields ignored', async () => {
  const f = fixture(); await f.auth('a', { action: 'login' });
  const { family } = await f.family('a', { action: 'create', name: '家', role: 'student', createdBy: 'fake', familyId: 'fake' });
  assert.equal(family.members[0].role, 'admin'); assert.equal(family.timezone, 'Pacific/Auckland'); assert.notEqual(family.id, 'fake');
  await rejects(() => f.family('a', { action: 'create', name: '另一个家' }), 'ALREADY_IN_FAMILY');
});
test('concurrent create permits only one family per account', async () => {
  const f = fixture(); await f.auth('a', { action: 'login' });
  const results = await Promise.allSettled([1,2].map(() => f.family('a', { action: 'create', name: '家' })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(Object.keys(f.db.records.families).length, 1); assert.ok(f.db.conflicts > 0);
});
test('invite is hash-only, 24h, one use, and join synchronizes both member records', async () => {
  const f = await setup(); const { code, expiresAt } = await f.family('admin', { action: 'invite' });
  assert.match(code, /^[A-F0-9]{12}$/); assert.equal(expiresAt, '2026-10-21T00:00:00.000Z');
  assert.ok(!JSON.stringify(f.db.records).includes(code));
  const { family } = await f.family('student', { action: 'join', code, role: 'student' });
  assert.equal(family.members.length, 2);
  const me = await f.auth('student', { action: 'login' }); assert.equal(me.user.familyId, f.familyId);
  await rejects(() => f.family('outsider', { action: 'join', code, role: 'parent' }), 'INVITE_INVALID');
});
test('competing joins consume an invite exactly once under transaction retry', async () => {
  const f = await setup(); const { code } = await f.family('admin', { action: 'invite' });
  const results = await Promise.allSettled(['parent', 'student'].map(who => f.family(who, { action: 'join', code, role: 'student' })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.db.records.families[f.familyId].members.length, 2); assert.ok(f.db.conflicts > 0);
});
test('expired, revoked and superseded invitations cannot be consumed', async () => {
  const f = await setup(); const first = await f.family('admin', { action: 'invite' });
  await rejects(() => f.family('admin', { action: 'invite' }), 'INVITE_THROTTLED');
  f.advance(31000); const second = await f.family('admin', { action: 'invite' });
  await rejects(() => f.family('parent', { action: 'join', code: first.code, role: 'parent' }), 'INVITE_INVALID');
  await f.family('admin', { action: 'revokeInvite' });
  await rejects(() => f.family('parent', { action: 'join', code: second.code, role: 'parent' }), 'INVITE_INVALID');
  f.advance(31000); const third = await f.family('admin', { action: 'invite' }); f.advance(24 * 3600 * 1000);
  await rejects(() => f.family('parent', { action: 'join', code: third.code, role: 'parent' }), 'INVITE_INVALID');
});
test('family capacity is three; join cannot request admin role', async () => {
  const f = await setup(); const { code } = await f.family('admin', { action: 'invite' });
  await rejects(() => f.family('parent', { action: 'join', code, role: 'admin' }), 'INVALID_INPUT');
  await f.family('parent', { action: 'join', code, role: 'parent' }); f.advance(31000);
  await join(f, 'student', 'student');
  await rejects(() => f.family('admin', { action: 'invite' }), 'FAMILY_FULL');
});
test('outsider cannot select another family using a supplied familyId', async () => {
  const f = await setup();
  for (const action of ['get','invite','update','removeMember','setRole','leave']) {
    await rejects(() => f.family('outsider', { action, familyId: f.familyId, userId: hash('user:admin') }), 'NO_FAMILY');
  }
  const other = await f.family('outsider', { action: 'create', name: '另一个家' });
  const own = await f.family('outsider', { action: 'get', familyId: f.familyId }); assert.equal(own.family.id, other.family.id);
});
test('ordinary members cannot mutate roles, invites or settings', async () => {
  const f = await setup(); await join(f, 'parent');
  for (const action of ['invite','revokeInvite','update','removeMember','setRole']) {
    await rejects(() => f.family('parent', { action, userId: hash('user:admin'), role: 'admin', name: 'fake', timezone: 'Asia/Shanghai' }), 'FORBIDDEN');
  }
});
test('admin can change normal roles, but cannot remove or downgrade admin', async () => {
  const f = await setup(); await join(f, 'student', 'student');
  const r = await f.family('admin', { action: 'setRole', userId: hash('user:student'), role: 'parent' });
  assert.equal(r.family.members[1].role, 'parent');
  await rejects(() => f.family('admin', { action: 'setRole', userId: hash('user:student'), role: 'admin' }), 'INVALID_INPUT');
  await rejects(() => f.family('admin', { action: 'removeMember', userId: hash('user:admin') }), 'FORBIDDEN');
});
test('profile rename synchronizes family and does not affect other members', async () => {
  const f = await setup(); await join(f, 'parent');
  await f.auth('parent', { action: 'updateProfile', displayName: '妈妈', userId: hash('user:admin') });
  const { family } = await f.family('admin', { action: 'get' });
  assert.equal(family.members[1].displayName, '妈妈'); assert.notEqual(family.members[0].displayName, '妈妈');
});
test('removed users lose access immediately and can join a new family', async () => {
  const f = await setup(); await join(f, 'parent');
  await f.family('admin', { action: 'removeMember', userId: hash('user:parent') });
  await rejects(() => f.family('parent', { action: 'get', familyId: f.familyId }), 'NO_FAMILY');
  assert.equal(f.db.records.users[hash('user:parent')].familyId, null);
  const r = await f.family('parent', { action: 'create', name: '新家庭' }); assert.notEqual(r.family.id, f.familyId);
});
test('leaving revokes access; final admin leave archives family and old invitation', async () => {
  const f = await setup(); await join(f, 'parent');
  await rejects(() => f.family('admin', { action: 'leave' }), 'ADMIN_LEAVE');
  await f.family('parent', { action: 'leave' }); f.advance(31000);
  const { code } = await f.family('admin', { action: 'invite' }); await f.family('admin', { action: 'leave' });
  assert.ok(f.db.records.families[f.familyId].deletedAt); assert.equal(f.db.records.families[f.familyId].members.length, 0);
  await rejects(() => f.family('student', { action: 'join', code, role: 'student' }), 'INVITE_INVALID');
});
test('family settings validate timezone and persist UTC timestamps', async () => {
  const f = await setup(); f.advance(60000);
  const r = await f.family('admin', { action: 'update', name: '新家', timezone: 'Europe/London' });
  assert.equal(r.family.timezone, 'Europe/London'); assert.equal(f.db.records.families[f.familyId].updatedAt, '2026-10-20T00:01:00.000Z');
});
test('failed transaction leaves no partial family/user writes', async () => {
  const f = await setup(); const before = structuredClone(f.db.records); f.db.failWrite = true;
  await assert.rejects(() => f.family('admin', { action: 'update', name: '坏写入', timezone: 'Asia/Shanghai' }));
  assert.deepEqual(f.db.records, before);
});
test('handler uses trusted WX context, returns safe errors, allows no caller identity', async () => {
  const db = new MemoryDB(); let options;
  const cloud = { database: config => { options = config; return db; }, getWXContext: () => ({ OPENID: 'trusted' }) };
  const handler = makeHandler(cloud, 'auth');
  const r = await handler({ action: 'login', OPENID: 'attacker' }); assert.equal(r.data.user.id, hash('user:trusted'));
  assert.equal(options.throwOnNotFound, false);
  db.failWrite = true; const failed = await handler({ action: 'login' }); assert.deepEqual(failed, { ok: false, error: { code: 'INTERNAL' } });
});
test('concurrent joins to different families still bind a user only once', async () => {
  const f = await setup();
  const other = await f.family('outsider', { action: 'create', name: '第二个家' });
  const first = await f.family('admin', { action: 'invite' });
  const second = await f.family('outsider', { action: 'invite' });
  const results = await Promise.allSettled([first.code, second.code].map(code => f.family('parent', { action: 'join', code, role: 'parent' })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const bound = f.db.records.users[hash('user:parent')].familyId;
  assert.ok([f.familyId, other.family.id].includes(bound));
  assert.equal(Object.values(f.db.records.families).filter(f => f.members.some(m => m.userId === hash('user:parent'))).length, 1);
  await rejects(() => f.family('outsider', { action: 'removeMember', userId: hash('user:admin'), familyId: f.familyId }), 'FORBIDDEN');
});
