Page({
  data: { version: getApp().globalData.version },
  showAbout() {
    wx.showModal({ title: '关于小程序', content: '这是我们小程序的第一步。更多功能，正在慢慢生长。', showCancel: false });
  },
  onShareAppMessage() {
    return { title: '来看看我的小程序', path: '/pages/home/home' };
  }
});
