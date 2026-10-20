# 留学家园开发约定

原生微信小程序在 miniprogram/，Node 云函数在 cloudfunctions/，依赖微信云开发。
使用当前隔离检出目录，不创建额外 worktree。开始前阅读 README.md 和 docs/phase-1.md。
Node.js 22/24 下 npm ci，提交前 npm run validate。
共享云函数代码在 cloudfunctions/_shared/，改动后 npm run cloud:prepare；不要只改各函数生成的 lib/。
云函数只使用可信 getWXContext().OPENID 确定身份，客户端 familyId/role/openid 都不可信。
客户端禁止直接访问数据库、文件或分享家庭内容。跨家庭访问、并发邀请码消费必须有测试。
实际密钥、project.private.config.json、云环境本地配置、二维码产物不提交。
本阶段只完成身份、家庭、首页框架；二至四阶段等用户在微信工具验收后再做。
本地 Node 测试不代表真实云端、微信编译或多账号真机通过。上传/审核/发布不可混称。
