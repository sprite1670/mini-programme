# 数据库设计与隔离

状态：第一阶段实现 users、families、invitations。events/tasks/expenses/documents/posts 为后续阶段设计，尚无写入接口或已交付功能。不要在控制台录入真实敏感业务数据来代替尚未实现的权限接口。

## 共同约定

所有集合含 `_id:string`（必填唯一）、`familyId:string|null`、`createdBy:string`、`createdAt:string`、`updatedAt:string`。这些字段只能由云函数设置，客户端不能修改。时间统一为服务端生成的 UTC ISO 8601 字符串（含毫秒、Z 后缀），可按字典顺序比较。用户未绑定时 `familyId=null`；其余业务记录必须有有效 familyId。families 的 familyId 等于自身 _id。createdBy 是内部 userId，不直接暴露 OpenID。

后续业务集合统一 `deletedAt:UTC|null = null`；外键必须在云函数中校验属于当前家庭，成员离开后历史记录保留内部 ID 与当时的显示名快照。不能根据客户端提供的 familyId 建查询。

## 第一阶段字段（均为必填，除非标记可空）

| 集合 | 字段与类型、默认值 |
| --- | --- |
| users | `_id=SHA256('user:'+OPENID)`；`openid:string`（仅服务端）；`familyId:string|null=null`；`displayName:string[1..24]`（默认“家人”加 ID 前4位）；公共 createdBy=自身 ID，时间为首次登录/最后更新 |
| families | `_id='f_'+随机128位hex`；`familyId=_id`；`name:string[1..40]`；`timezone:IANA字符串='Pacific/Auckland'`；`adminId:userId`；`members:Member[1..3]`，归档时可空数组；`activeInviteId:string|null=null`；`inviteGeneration:integer=0`；`lastInviteAt:UTC|null=null`；`deletedAt:UTC|null=null` |
| invitations | `_id=SHA256('invite:'+code)`；`familyId`；`generation:integer`；`expiresAt:UTC=创建+24小时`；`usedAt:UTC|null=null`；`usedBy:userId|null=null`；`revokedAt:UTC|null=null`；公共 createdBy=生成邀请码的管理员 ID |

Member={userId:string,displayName:string,role:'admin'|'parent'|'student',joinedAt:UTC}。管理员唯一且等于 adminId。成员上限3。代码中的时区白名单为基督城、北京、悉尼、伦敦、洛杉矶、纽约、温哥华；基督城使用 Pacific/Auckland，不能固定加12小时（存在夏令时）。

邀请码为48位随机值，显示为12位大写hex；仅在生成响应中出现一次，不以明文存数据库或日志。仅管理员生成，间隔至少30秒。每家庭仅一个有效邀请码；重新生成、主动撤销、管理员归档、移除成员都会通过 activeInviteId/generation 使旧码失效。revokedAt 为未来审计预留，目前失效依据并非该字段单独决定。消费时在同一事务校验有效期、代数、成员数和用户未绑定，并写用户、家庭、邀请码。只到期不自动删除，过期码始终拒绝消费。

## 后续阶段完整字段设计（未实现）

以下均含上述公共字段和 deletedAt；未说明的业务字段必填。

| 集合 | 业务字段与默认值 |
| --- | --- |
| events | title:string[1..100]；category:school/exam/travel/payment/life/other='other'；memberIds:userId[]=当前家庭有效成员子集，默认[]；startAt/endAt:UTC（end>start）；originalTimezone:IANA；allDay:boolean=false；localStartDate/localEndDate:string YYYY-MM-DD|null（全天时必填，结束日期为排他）；notes:string[0..2000]='' |
| tasks | title:string[1..100]；assigneeId:userId；assigneeNameSnapshot:string；dueAt:UTC；originalTimezone:IANA；status:todo/doing/done='todo'；notes:string[0..2000]=''；completedAt:UTC|null=null（完成写服务端时间，重新打开则置空） |
| expenses | amountMinor:安全正整数（分/cent，不能用浮点金额）≥1；currency:CNY/NZD；category:tuition/housing/food/transport/shopping/medical/other；payerId:userId；payerNameSnapshot:string；paidAt:UTC；originalTimezone:IANA；month:string YYYY-MM（按账本原始时区计算）; notes:string[0..2000]=''；exchangeRate:十进制定点字符串|null=null；rateDate:YYYY-MM-DD|null=null；rateBase/rateQuote:CNY/NZD|null=null（汇率表示1 base兑换quote，成组填写；原始金额不覆盖） |
| documents | title:string[1..100]；category:school/visa/insurance/housing/travel/emergency/other；content:string[0..10000]=''；visibility:private/family='private'；expiresOn:YYYY-MM-DD|null=null；originalTimezone:IANA；attachments:Attachment[]=[], 至少文字或附件之一非空 |
| posts | content:string[1..2000]；photos:Attachment[]=[],上限9；authorNameSnapshot:string。仅家庭内时间倒序，不提供陌生人分享/搜索 |

Attachment={fileId:云存储ID（服务端保存）,storagePath:随机私有路径,name:string,size:正整数,mimeType:string,uploadedAt:UTC}。不保存公开URL；云函数返回资料时不直接把 fileId 当公开下载链接输出。照片与资料附件同样需要权限校验。具体大小、文件类型和上传配额在第三阶段实施前固定并测试。

## 索引与访问规则

`database/indexes.json` 为索引清单与阶段标记，不是可直接导入的微信部署文件。第一阶段所有操作按 _id 读取，默认唯一索引已足够；邀请码查找也使用哈希 _id。后续组合索引需要在云控制台逐个创建并用真实查询验证，缺索引不能以开放权限解决。

每个集合分别应用 `database/rules.json`（read=false/write=false）；客户端 SDK 无权直接查询和写入，控制台及可信云函数管理员 SDK 是另一安全边界。云函数不能配置为公开匿名 HTTP API。普通客户端只通过 wx.cloud.callFunction 调用。

云存储设置自定义规则 `database/storage.rules.json`，禁止所有客户端读取、上传、覆盖和删除；第一阶段没有上传功能。第三阶段必须实现受控上传、保存关联、短期签名访问/服务端下载与删除，先检查当前成员身份、familyId、可见性和创建者。管理员也不能读取他人的 private 资料。不得把 bucket 改为公共读来实现预览。临时链接有有效期内转发风险，应尽量缩短有效期、避免日志/缓存/分享，并在离家后明确链接失效边界。

## 权限边界

auth 根据 getWXContext().OPENID 派生当前 userId；忽略客户端自报身份。家庭接口从 users.familyId 推导真实家庭并再次核对 members，而非信任缓存角色。创建、邀请核销、成员变更、档案修改均事务执行；家庭级单文档成员数组使人数/角色变更产生事务冲突并重试，不使用“先查人数再非事务插入”。

第一阶段：管理员可改家庭名称/时区、邀请/撤销、改普通成员为家长/学生、移除普通成员。普通成员只能查看本家庭、改本人称呼或退出。不能自封管理员；管理员不能把自己移除/降级。管理员须先移除其他成员，最后退出才归档家庭，避免孤儿管理员。

后续：日程由创建者或管理员修改；任务创建者/管理员改字段，负责人仅更新状态；费用创建者/管理员修改；家庭资料成员可读但仅创建者/管理员编辑，private仅创建者可读写；动态仅作者可删除。每次读写和文件签名之前重新查成员；禁止仅凭文档ID读取。

## 删除、恢复与导出

- 当前成员退出/被移除：原子解除 users.familyId 与 family.members；历史业务记录不转移到新家庭。退出本机登录仅清除内存，不解绑家庭。
- 当前家庭归档：deletedAt置服务端时间、成员清空、邀请码失效；此后所有普通接口拒绝访问。不自动级联永久删除。第一阶段不提供恢复按钮。
- 后续业务软删除：deletedAt默认null，所有查询必须过滤；建议30天回收站，仅原操作授权者/家庭管理员恢复且重新校验归属。私人资料只有作者可恢复。物理删除附件须先确认不存在其他引用，清理失败保留重试记录。第四阶段实现并验证，当前不承诺自动清理或恢复。
- 账号删除/恢复目前只能由部署管理员离线核实身份，在控制台操作并备份；不要直接删除 users 导致家庭成员残留。正式上线前需完成产品化删除和审计流程。
- 第四阶段实现分页导出：每次云函数重新确认成员/角色，导出JSON + UTF-8 CSV（处理公式注入），保留UTC、时区、原币、整数金额；普通成员不能导出他人private资料，管理员也不能。不导出openid、邀请码、私钥、原始fileId或长期公开链接；附件单独授权导出。短期私有导出产物过期清理，下载前再次校验，分页快照需说明一致性界限。
- 第一阶段设置页明确显示导出/永久删除未开放；没有用虚假下载按钮假装完成。
