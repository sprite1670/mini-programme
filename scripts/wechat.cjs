const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPrivateKey } = require('node:crypto');

async function main() {
  const action = process.argv[2];
  if (!['preview', 'upload'].includes(action)) throw new Error('Use preview or upload.');
  const appid = process.env.WX_APPID;
  const privateKey = process.env.WX_PRIVATE_KEY;
  if (!/^wx[0-9a-f]{16}$/.test(appid || '') || !privateKey) {
    throw new Error('Configure WX_APPID and WX_PRIVATE_KEY in GitHub Actions Secrets first.');
  }
  // Validate locally without logging key material or passing it as an argument.
  try { createPrivateKey(privateKey); } catch { throw new Error('WX_PRIVATE_KEY must contain the complete PEM private key.'); }
  const version = process.env.WX_VERSION || '0.1.0';
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('WX_VERSION must use x.y.z format.');
  const robot = Number(process.env.WX_ROBOT || 1);
  if (!Number.isInteger(robot) || robot < 1 || robot > 30) throw new Error('WX_ROBOT must be between 1 and 30.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-upload-'));
  try {
    const keyPath = path.join(temp, 'private.key');
    fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });
    const ci = require('miniprogram-ci');
    const project = new ci.Project({ appid, type: 'miniProgram', projectPath: path.resolve(__dirname, '..'), privateKeyPath: keyPath, ignores: ['node_modules/**/*', '.git/**/*', 'artifacts/**/*'] });
    const options = { project, version, desc: process.env.WX_DESCRIPTION || '基础框架开发版', robot, setting: { es6: true, minify: true }, onProgressUpdate: () => {} };
    if (action === 'preview') {
      const artifacts = path.resolve(__dirname, '../artifacts');
      fs.mkdirSync(artifacts, { recursive: true });
      await ci.preview({ ...options, qrcodeFormat: 'image', qrcodeOutputDest: path.join(artifacts, 'preview.png'), pagePath: 'pages/index/index' });
    } else {
      await ci.upload(options);
    }
    console.log(`WeChat ${action} completed. Confirm access and version in WeChat before sharing.`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(() => {
  // Keep external SDK errors out of CI logs: they may contain sensitive request data.
  console.error('WeChat operation failed. Check Secrets, PEM formatting, x.y.z version, robot (1–30), upload permission and runner IP whitelist. No automatic retry or publish was performed.');
  process.exitCode = 1;
});
