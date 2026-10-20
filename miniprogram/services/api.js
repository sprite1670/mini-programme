const messages = {
  NO_IDENTITY: '请使用已登录的微信账号打开小程序', NO_FAMILY: '请先创建或加入家庭',
  ALREADY_IN_FAMILY: '你已经加入一个家庭，请先退出', FORBIDDEN: '你没有此操作权限',
  INVITE_INVALID: '邀请码无效、已失效或已被使用', FAMILY_FULL: '家庭已满，最多支持 3 人',
  ADMIN_LEAVE: '管理员须先移除其他成员，才能退出并归档家庭',
  INVALID_INPUT: '填写内容不符合要求，请检查后重试', NOT_FOUND: '记录不存在或已失效',
  INVITE_THROTTLED: '请稍后再生成邀请码', INTERNAL: '服务暂不可用，请检查云函数、集合和索引配置'
};
async function call(name, action, data) {
  if (!getApp().globalData.cloudReady) throw new Error('请先在 config/cloud.js 填写云环境 ID，并部署云函数');
  let response;
  try { response = await wx.cloud.callFunction({ name, data: Object.assign({}, data, { action }) }); }
  catch (_) { throw new Error('无法连接云服务，请检查网络、云环境 ID 和云函数部署状态'); }
  const result = response.result;
  if (!result || !result.ok) throw new Error(messages[result && result.error && result.error.code] || messages.INTERNAL);
  return result.data;
}
module.exports = { call };
