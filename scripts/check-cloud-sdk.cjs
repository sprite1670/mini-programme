// Runs the actual installed wx-server-sdk facade against a local adapter, without cloud credentials.
const assert = require('node:assert/strict');
const { MemoryDB } = require('../tests/helpers.cjs');
const { makeService } = require('../cloudfunctions/_shared/service');
async function check(name) {
  const cloud = require(`../cloudfunctions/${name}/node_modules/wx-server-sdk`);
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const db = cloud.database({ throwOnNotFound: false });
  assert.equal(typeof db.runTransaction, 'function');
  const memory = new MemoryDB();
  db._db.runTransaction = callback => memory.runTransaction(tx => callback({
    collection: name => ({ doc: id => ({
      get: async () => tx.collection(name).doc(id).get(),
      set: async data => { await tx.collection(name).doc(id).set({ data }); return { updated: 1 }; }
    }) })
  }));
  const service = makeService({ db });
  const user = await service.auth('sdk-test', { action: 'login' });
  assert.equal(user.user.familyId, null);
  const r = await service.family('sdk-test', { action: 'create', name: 'SDK adapter test' });
  assert.equal(r.family.members[0].userId, user.user.id);
  const code = await service.family('sdk-test', { action: 'invite' });
  assert.match(code.code, /^[A-F0-9]{12}$/);
  console.log(`${name}: real wx-server-sdk transaction/document facade passed against local adapter (no live cloud call).`);
}
(async () => { await check('auth'); await check('family'); })().catch(e => { console.error(e); process.exitCode = 1; });
