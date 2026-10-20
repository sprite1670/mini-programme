const config = require('./config/cloud');
App({
  globalData: { version: '1.0.0-stage1', cloudReady: false },
  onLaunch() {
    if (wx.cloud && config.envId) {
      wx.cloud.init({ env: config.envId, traceUser: false });
      this.globalData.cloudReady = true;
    }
  }
});
