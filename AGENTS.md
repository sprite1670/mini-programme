# 开发约定

这是原生微信小程序，应用目录为 `miniprogram/`，不依赖 Web 服务或数据库。
每个云任务已隔离，使用现有检出目录，不要创建额外 Git worktree。
阅读 README.md 后开发，使用 Node.js 22 或 24，先 `npm ci`，提交前 `npm run validate`。
不要提交上传私钥、环境文件、二维码产物或个人 project.private.config.json。
AppID、微信私钥通过 GitHub Actions Secrets 配置，禁止向用户索要聊天中的密钥值。
微信上传仅手动触发；正式提交审核和发布由账号管理员操作，不自动发布。
Node 测试是逻辑与结构验证，不是微信编译器或真机验证；报告时明确区别。
