const { getChannel } = require('./utils/track');
const { call, isMock } = require('./utils/cloud');

App({
  onLaunch(options) {
    if (!isMock()) {
      // 真实云端模式：初始化云开发环境
      if (!wx.cloud) {
        console.error('请使用 2.2.3 以上的基础库以使用云能力');
        return;
      }
      // TODO: 替换为你自己的云开发环境 ID
      wx.cloud.init({ env: 'YOUR_ENV_ID', traceUser: true });
    }

    // 渠道归因：分享卡片 / 扫码 / 公众号菜单进入时携带 channel 参数
    const channel = getChannel(options);
    this.globalData.channel = channel;

    // 静默登录建档：openid + 渠道来源落库（演示模式为本地模拟）
    call('login', { channel }).then((data) => {
      this.globalData.openid = data.openid;
      if (this.loginReadyCallback) {
        this.loginReadyCallback(data);
      }
    }).catch((err) => {
      console.error('silent login failed', err);
    });
  },

  globalData: {
    openid: null,
    channel: 'direct',
  },
});
