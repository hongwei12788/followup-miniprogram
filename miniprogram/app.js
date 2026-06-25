App({
  globalData: {
    cloudEnv: 'prod-d8g08pnyv06c53a1e',
    cloudService: 'express-nh6h',
    token: null,
    userInfo: null,
  },
  onLaunch() {
    wx.cloud.init({
      env: this.globalData.cloudEnv,
      traceUser: true,
    });

    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
    }
  },
});
