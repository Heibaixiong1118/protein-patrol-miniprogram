const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 订阅消息下发（云调用，免维护 access_token）
// 调用示例：call('notify', { templateId, data: { thing1: { value: '处理完成' } } })
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  try {
    await cloud.openapi.subscribeMessage.send({
      touser: event.openid || OPENID,
      templateId: event.templateId,
      page: event.page || 'pages/index/index',
      data: event.data || {},
      miniprogramState: 'formal',
    });
    return { code: 0, data: { sent: true } };
  } catch (err) {
    return { code: 500, message: err.errMsg || 'send failed' };
  }
};
