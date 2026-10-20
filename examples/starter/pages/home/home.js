Page({
  data: { count: 0 },
  increment() { this.setData({ count: this.data.count + 1 }); },
  openProfile() { wx.switchTab({ url: '/pages/profile/profile' }); },
  onShareAppMessage() {
    return { title: '来看看我的小程序', path: '/pages/home/home' };
  }
});
