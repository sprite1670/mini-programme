# 第一阶段交付与验收

## 阶段计划

1. 本次：初始化云开发配置、身份/账号、家庭创建/邀请、成员权限、首页和导航。
2. 等本阶段微信工具验证后：日程CRUD、月历/列表、UTC/原始时区；任务权限/状态/到期提示；真实多账号同步验证。
3. 再后：CNY/NZD整数账本、受控私有资料文件、家庭动态。
4. 最后：安全回归、界面完善、分页导出/数据管理、发布准备。

不预先创建空的calendar/task等云函数假装实现；本阶段实际部署函数只有auth和family。其余页面在对应阶段注册，第一阶段仅注册7个已实际存在页面。

## 完成文件清单

- 根目录：app相关配置位于下述miniprogram；`project.config.json` 新增cloudfunctionRoot和基础库；`package.json`/`package-lock.json`、`AGENTS.md`、`README.md`更新。
- 应用：`miniprogram/app.js`、`app.json`、`app.wxss`、`config/cloud.js`、`services/api.js`、`utils/page.js`、`utils/time.js`。
- 7页，每页均有.js/.json/.wxml/.wxss：`pages/index/index`、`pages/calendar/index`、`pages/tasks/index`、`pages/profile/index`、`pages/family/index`、`pages/members/index`、`pages/settings/index`。
- 云函数：`cloudfunctions/auth/` 与 `family/` 各含 `index.js`、`config.json`、`package.json`、`package-lock.json`、`lib/service.js`；共享源为`cloudfunctions/_shared/service.js`。
- 数据：`database/rules.json`、`storage.rules.json`、`indexes.json`。
- 验证：`scripts/prepare-cloud.cjs`、`check.cjs`、`check-cloud-sdk.cjs`；`tests/helpers.cjs`、`family.test.cjs`、`pages.test.cjs`。
- 上传工具：`scripts/wechat.cjs` 预览入口改为新首页；现有`.github/workflows/`保留，`check.yml`增加云SDK依赖与适配验证。旧通用页面移动至`examples/starter/pages/`。
- 文档：本文件、`docs/database.md`、`deployment.md`、`release-checklist.md`。

## 本地检查结果口径

本轮本地执行结果：26项测试通过，0失败、0跳过。两个真实SDK门面均通过本地适配验证。

`npm run validate` 实际执行JS语法、JSON解析、注册页面四件套、模板事件绑定检查以及业务与权限测试。事务测试使用带乐观冲突重试的内存数据库，不是微信云数据库。

`node scripts/check-cloud-sdk.cjs` 载入锁定的真实微信云SDK，用本地适配器验证文档/事务接口契约；不访问云端，不代表已部署。

WXML做事件、结构和插值表达式的语法检查，没有微信官方编译器结果。没有微信账号、AppID、已绑定云环境时，不能把静态检查说成“构建通过”。本阶段没有云数据库/存储已应用规则、微信真机或GitHub远端CI通过的证据。

## 用户手动配置

- 确认GitHub仓库Private；AppID、微信代码上传Secrets按原设置保留。
- 微信工具填写真实AppID；在config/cloud.js填入测试envId。
- 创建users/families/invitations；逐集合保存全禁客户端规则；存储同样全禁。
- 在同一个测试环境上传部署auth/family（云端安装依赖），选择兼容的Node运行时。
- 用不同微信号开发/体验需先配置微信平台成员权限，再测试本应用邀请码。
- 以上配置不会由GitHub的preview/upload自动完成。

## 微信开发者工具验收步骤（当前均待用户执行）

准备微信号A（父/母）、B（学生）、可选C（另一位家长）、D（不在家庭的测试号）。测试数据不要使用真实敏感资料。

| 步骤 | 操作和预期 |
| --- | --- |
| 1 配置错误 | envId留空时点击登录应给出配置提示，不创建假家庭、不伪造登录成功 |
| 2 首次身份 | 配置部署后A登录；users中只出现一条A记录，重复登录/重新编译不重复创建；前端响应无OpenID |
| 3 创建家庭 | A创建“验收小家”；A为管理员，默认Pacific/Auckland；不能再创建第二个家庭 |
| 4 邀请加入 | A在成员页生成邀请码，B用不同微信登录并选择学生加入；A下拉刷新、B首页看到同一家庭与两人；新码不能由B重复消费 |
| 5 并发消费 | 在测试工具/真机让B与C同时消费一个新码，恰好一个成功；另一个看到失效，三集合无不一致。**真实事务必须实测** |
| 6 邀请时效 | A生成码后撤销再让未绑定账号尝试，应拒绝；间隔30秒重新生成，旧码拒绝。过期场景可等待24h或仅在隔离测试环境管理员调整expiresAt，不改客户端时间来伪造云端过期 |
| 7 人数限制 | 按次生成码让第三人加入，满3人后不能再生成；不存在第4名成员 |
| 8 权限边界 | B调用invite/update/removeMember/setRole应FORBIDDEN，伪造openid/role/familyId不获得A权限；D读A家庭只能NO_FAMILY或返回D自己家庭，不能读到A数据 |
| 9 称呼同步 | B在“我的”改称呼；A下拉刷新/重新进入看到新称呼，不获取微信昵称头像 |
| 10 成员移除 | A移除B，B再次进入/刷新立即失去云端家庭访问，不能凭旧familyId读取；允许B创建新家庭；A仍在原家庭 |
| 11 退出归档 | 普通成员退出后解绑；A有其他成员时不能退出，最后只剩A再退出则归档并使邀请码失效；退出本机登录不等于退家庭 |
| 12 时区与UI | 在320/375/414逻辑像素屏幕、深/浅背景可读场景检查；北京/基督城两地时间正确、夏令时测试见本地用例；A切时区B刷新后同步；按钮至少44px |
| 13 网络与空态 | 断网重试、未登录、无家庭、加载中、写入失败提示清晰；重复点击按钮不重复提交；日程待办明确提示后续阶段，无虚构数据 |
| 14 数据规则 | 使用客户端wx.cloud.database对users等各集合直接get/add/update必须失败；客户端存储上传/下载/删除也必须拒绝。云函数仍可正常操作，不能为使页面工作而开放数据库 |
| 15 分享限制 | 各页面无公开分享按钮/处理器，不对外发家庭名称、成员、内容；邀请码仅管理员主动复制后私下发送 |

验证后请反馈“步骤号＋结果＋已脱敏错误码”，不要发送私钥、OpenID、邀请码或家庭敏感内容。

## 微信工具验收修复：WXML条件表达式

用户首次在微信开发者工具编译时报告 family/index.wxml 条件表达式错误。原因是4个页面在 {{ }} 中错误使用 HTML 实体 `&amp;&amp;`，已统一修正为原始逻辑运算符 `&&`。修复文件为 pages/index/index.wxml、pages/family/index.wxml、pages/members/index.wxml、pages/profile/index.wxml。

新增 scripts/wxml-expressions.cjs 并接入 npm run check，配套 tests/wxml.test.cjs。检查只解析表达式、不执行代码，真实复现旧版4个模板失败、修复后通过。修复后26项本地测试通过；微信开发者工具重新编译仍需用户确认。

更新电脑项目时，只需从GitHub最新ZIP复制上述4个WXML文件覆盖对应路径。不要覆盖已填写的 project.config.json 或 miniprogram/config/cloud.js；无需为本修复重新部署云函数。
