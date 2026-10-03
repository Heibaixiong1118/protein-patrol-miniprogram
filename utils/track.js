// 渠道归因工具：从启动参数中解析渠道来源
// 约定：分享路径 / 公众号菜单 / 二维码统一携带 channel=xxx 参数
// 例：/pages/index/index?channel=share_result、scene=channel%3Dposter_001
function getChannel(launchOptions) {
  const { query = {}, scene } = launchOptions || {};

  // 1. 普通 query 参数（分享卡片、公众号菜单、公众号图文链接）
  if (query.channel) {
    return query.channel;
  }

  // 2. 小程序码 scene 参数（扫码进入，scene 需要 decode）
  if (query.scene) {
    const params = decodeURIComponent(query.scene);
    const match = params.match(/channel=([^&]+)/);
    if (match) {
      return match[1];
    }
  }

  // 3. 兜底：用微信场景值记录进入来源
  // 1001 发现栏入口 / 1005 顶部搜索框 / 1007 单聊会话 / 1008 群聊会话 / 1011 扫码
  return `scene_${scene || 'unknown'}`;
}

module.exports = { getChannel };
