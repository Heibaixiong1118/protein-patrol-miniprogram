Page({
  data: {},

  // 邀请分享：固定 channel=invite，便于单独统计活动效果
  onShareAppMessage() {
    return {
      title: '一起记录热量，练出理想身材',
      path: '/pages/index/index?channel=invite',
    };
  },

  onShareTimeline() {
    return {
      title: '健身先算热量，这个工具 3 秒记一餐',
      query: 'channel=invite_moments',
    };
  },
});
