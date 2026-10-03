const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 静默登录：openid 建档 + 渠道来源记录
// 数据库集合：users（{_openid, channel, createdAt, lastActiveAt, visitCount}）
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const channel = event.channel || 'direct';
  const users = db.collection('users');
  const now = db.serverDate();

  const exist = await users.where({ _openid: OPENID }).get();

  if (exist.data.length === 0) {
    // 新用户建档：记录首次来源渠道
    await users.add({
      data: {
        _openid: OPENID,
        channel,
        createdAt: now,
        lastActiveAt: now,
        visitCount: 1,
      },
    });
  } else {
    // 老用户回访：更新活跃时间与次数
    await users.doc(exist.data[0]._id).update({
      data: {
        lastActiveAt: now,
        visitCount: exist.data[0].visitCount + 1,
      },
    });
  }

  return { code: 0, data: { openid: OPENID } };
};
