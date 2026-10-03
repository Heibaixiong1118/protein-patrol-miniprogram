const { call } = require('../../../../utils/cloud');

Page({
  data: {
    list: [],
    loading: true,
  },

  onShow() {
    this.loadHistory();
  },

  async loadHistory() {
    this.setData({ loading: true });
    try {
      const list = await call('core', { action: 'history', payload: { days: 7 } });
      this.setData({ list, loading: false });
    } catch (err) {
      console.error('load history failed', err);
      this.setData({ loading: false });
    }
  },
});
