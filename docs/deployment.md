# 微信云开发部署（第一阶段）

本仓库可在微信开发者工具导入，不依赖第三方商业后端。云资源仍由你的小程序账号在微信平台开通；云开发可能产生平台费用，先检查当前套餐/配额。GitHub上传私钥不能替代云环境配置或云函数部署。

## 一次性配置

1. 使用小程序管理员账号登录微信开发者工具，导入**仓库根目录**，使用你的真实 AppID。`project.config.json` 默认仍是 `touristappid`，可改成真实 AppID（不是秘密）。不要把上传私钥填在这里。
2. 工具中开通“云开发”，选择测试环境，记录环境ID；在 `miniprogram/config/cloud.js` 的 envId 中填写。环境ID不是凭据，允许提交到私有仓库，以便GitHub预览构建使用相同环境。初次绑定请确认该云环境属于当前小程序 AppID。
3. cloudfunctionRoot 已设为 `cloudfunctions/`。选择相同云环境，创建 `users`、`families`、`invitations` 集合；其余五个集合可稍后创建，也可以现在创建空集合，但第一阶段不读写它们。
4. **每个**集合的安全规则选择自定义，应用 `database/rules.json`（客户端读、写全禁）。微信控制台展示方式可能不同，保存后要用客户端直连测试确实拒绝读写，不能只看文件存在。
5. 云存储自定义规则应用 `database/storage.rules.json`。第一阶段无文件上传，保持客户端全禁；后续签名文件访问模块完成前不能开放公共读。
6. 本地/云开发目录执行 `npm ci`、`npm run cloud:prepare`。在开发者工具分别右键 `cloudfunctions/auth` 和 `cloudfunctions/family`，选择“上传并部署：云端安装依赖”。共享代码已复制到各自 `lib/`，不要把 `_shared` 作为单独云函数部署。
7. 云函数选微信平台支持的 Node.js >=18 运行时（例如控制台可用的 Node.js 18/20），按锁定版本安装 wx-server-sdk 4.0.2；不是使用根目录的 Node.js 22 编译云函数。两函数建议超时20秒、内存256MB起，根据实际控制台支持设置。无定时触发器/开放HTTP触发器/第三方API密钥需求。
8. 编译后点“登录并进入家庭”。若出现服务不可用，逐项检查：真实AppID、envId、相同环境、两个云函数部署、三个集合存在、运行时和套餐状态。不要开放数据库客户端写入来修复云函数错误。

## 接口

统一 `wx.cloud.callFunction({name, data:{action,...}})`，返回 `{ok:true,data}` 或 `{ok:false,error:{code}}`。所有身份从 getWXContext 得到；接口不接收可信的openid/familyId/管理员标记。

| 函数 | action | 业务参数 |
| --- | --- | --- |
| auth | login | 无；幂等创建本人账号并返回本人/当前家庭公开字段 |
| auth | updateProfile | displayName:1–24字 |
| family | create | name:1–40字；timezone:白名单IANA，默认Pacific/Auckland |
| family | get | 无，返回当前家庭 |
| family | join | code:12位hex；role:parent/student |
| family | invite / revokeInvite | 无，仅管理员 |
| family | setRole | userId:当前家庭普通成员ID；role:parent/student，仅管理员 |
| family | removeMember | userId:当前家庭普通成员ID，仅管理员 |
| family | update | name、timezone，仅管理员 |
| family | leave | 无，成员本人；管理员仅能最后归档家庭 |

每次在事务里重新核对成员权限。邀请码单次有效，事务冲突由云SDK有限重试；若冲突重试耗尽，界面提示重试，不能重复非事务补写。

## GitHub与手机预览

1. 本项目设计用于私有仓库。原有Git读取权限不能证明仓库可见性；请在GitHub仓库确认显示 **Private**，如为Public，由仓库所有者在 Settings → General → Danger Zone → Change repository visibility 改为Private。不要上传真实用户数据到Git。
2. 现有 `Check` workflow 自动做本地结构/页面与权限单元测试；`WeChat` workflow 手动 preview/upload，仅上传小程序代码，**不会部署云函数或创建数据库**。
3. 在 GitHub Settings → Secrets and variables → Actions 添加 `WX_APPID` 和完整 `WX_PRIVATE_KEY`；不发到聊天或写入仓库。上传网络须满足微信IP白名单，固定出口runner可用 Actions变量 `WX_RUNNER` 指定标签；默认ubuntu-latest出口不固定，必须实际验证网络方案。
4. 修改并提交 `config/cloud.js` 的测试环境ID后，触发 WeChat → preview。成功时下载 `wechat-preview` artifact；二维码只保留一天。云函数须事先部署，否则手机登录会失败。
5. upload 仅上传开发版，管理员还需在微信后台设为体验版、添加体验成员。小程序体验成员资格与本应用内部的家庭成员绑定是两件事，必须分别配置。
6. 家庭内容不提供公开分享；管理员可把一次性邀请码私下发给家人。后台体验资格不会自动让陌生账号加入家庭。
7. 订阅消息、公众号、支付、公开社交不在第一阶段。不自动审核或正式发布。

## 运维与隐私

- 只记录安全的错误码，不记录OpenID、请求体、邀请码、私钥或完整云SDK异常。当前界面INTERNAL表示配置/平台故障；在控制台用安全的请求ID/错误分类排障，不把真实请求内容复制给第三方。
- 小程序后台按实际用途填写隐私保护指引：云端用户身份、用户填写称呼、家庭关系。无需获取手机号、定位、头像权限；后续上传文件/照片前更新指引与授权流程。
- 第一阶段无真实设备结果；见 phase-1.md 的验收表。生产与测试环境应分离，敏感正式数据、永久删除和导出待第四阶段完成再启用。
