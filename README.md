# 留学家园 · V1.0（第一阶段）

为父母和海外留学生组成的2–3人家庭提供私有家庭空间。原生微信小程序 + 微信云开发云函数/数据库；第一阶段实现身份、家庭创建/邀请、成员管理及首页框架，不含公共分享、支付或聊天。

## 本阶段交付

- 微信云函数获取身份、幂等建立账号、自定义称呼。
- 一账号一家庭、创建者管理员、家长/学生角色、上限3人。
- 24小时单次邀请码、并发核销事务、管理员撤销/移除、成员退出。
- 首页家庭成员、北京时间与基督城/其他时区时钟；四个正确注册的底部页面。
- 管理员修改家庭名称/时区、成员角色。数据库/存储客户端全禁规则。
- 日程、待办、账本、资料、动态和导出**尚未实现**，界面明确标注阶段。不把空数据占位视为业务已完成。

## 导入和运行

微信开发者工具直接导入本仓库根目录，填写真实AppID。开通测试云环境，在 `miniprogram/config/cloud.js` 填envId，创建3个集合、设置规则、部署 `auth` 和 `family` 后编译运行。

详细步骤：[部署指南](docs/deployment.md)；[第一阶段文件清单与验收](docs/phase-1.md)；[数据库/索引/隔离/恢复与导出设计](docs/database.md)。

```sh
cd /workspace/mini-programme
npm ci                         # Node.js 22 或 24
npm run cloud:prepare          # 修改共享代码后同步独立函数部署包
npm run validate               # 全项目JS/JSON、页面结构、业务与权限测试
npm ci --prefix cloudfunctions/auth
npm ci --prefix cloudfunctions/family
node scripts/check-cloud-sdk.cjs # 真实SDK接口配合本地适配器，非真实云端联调
```

云任务已经隔离，使用现有检出目录，不创建额外worktree。没有本地Web服务、数据库或localhost预览。云函数依赖 wx-server-sdk 4.0.2，独立锁文件可重复安装；实际云平台运行时选支持的Node.js>=18。

## 目录

```text
miniprogram/           微信应用、页面、客户端云调用、时区工具
cloudfunctions/auth/   身份和称呼；含独立依赖/锁文件
cloudfunctions/family/ 家庭、邀请码、成员；含独立依赖/锁文件
cloudfunctions/_shared/ 云端权限与事务公共源；生成到各函数lib/
database/              安全规则、各阶段索引清单
docs/                  部署、数据模型、阶段验收/发布检查
scripts/ tests/        验证、SDK适配验证、GitHub微信上传工具
examples/starter/      之前的通用框架页面存档，不注册、不部署为家庭页面
```

原始基础框架已保留在Git历史及 examples/starter/，没有删除其他项目。GitHub私有可见性需仓库所有者确认；不在仓库保存真实家庭数据或私钥。

## 手机开发及微信上传

保留现有 `Check` 自动检查与 `WeChat` 手动预览/上传流程。GitHub Secrets 配置 `WX_APPID`、`WX_PRIVATE_KEY`，上传IP白名单和可选固定出口 `WX_RUNNER` 见部署指南。二维码不保证同一手机可长按识别，需要真机实测。云函数部署与小程序上传是独立步骤。

**第一阶段交付后暂停，等待微信开发者工具验收，再继续第二阶段。** 本地Node测试不等于微信编译通过、云部署成功、多账号同步成功或正式发布。
