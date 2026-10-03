const { FOOD_DB } = require('./food');

// ============================================================
// 演示模式开关
// true  = 本地模拟数据：无需云环境/云函数，开发者工具里直接跑通全流程
// false = 真实云端：云开发环境配置好、云函数部署完成后改为 false
// ============================================================
const MOCK_MODE = true;

const STORAGE_KEYS = {
  profile: 'mock_profile',
  records: 'mock_records',
};

function read(key, fallback) {
  return wx.getStorageSync(key) || fallback;
}

function save(key, value) {
  wx.setStorageSync(key, value);
}

// ---------- 本地模拟实现 ----------
const mockHandlers = {
  login() {
    return { openid: 'mock_openid_demo' };
  },

  setProfile(payload) {
    save(STORAGE_KEYS.profile, payload);
    return payload;
  },

  add(payload) {
    const list = read(STORAGE_KEYS.records, []);
    const record = {
      _id: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...payload,
      createdAt: Date.now(),
    };
    list.unshift(record);
    save(STORAGE_KEYS.records, list);
    return { added: true };
  },

  remove(payload) {
    const list = read(STORAGE_KEYS.records, []);
    save(STORAGE_KEYS.records, list.filter((r) => r._id !== payload.id));
    return { removed: true };
  },

  today(payload) {
    const profile = read(STORAGE_KEYS.profile, null);
    const records = read(STORAGE_KEYS.records, []).filter((r) => r.date === payload.date);
    const totals = { intake: 0, burn: 0, protein: 0, carbs: 0, fat: 0 };
    records.forEach((r) => {
      if (r.type === 'food') {
        totals.intake += r.kcal;
        totals.protein += r.protein || 0;
        totals.carbs += r.carbs || 0;
        totals.fat += r.fat || 0;
      } else {
        totals.burn += r.kcal;
      }
    });
    totals.protein = Math.round(totals.protein * 10) / 10;
    totals.carbs = Math.round(totals.carbs * 10) / 10;
    totals.fat = Math.round(totals.fat * 10) / 10;
    return { profile, totals, records };
  },

  history() {
    const byDate = {};
    read(STORAGE_KEYS.records, []).forEach((r) => {
      if (!byDate[r.date]) {
        byDate[r.date] = { date: r.date, intake: 0, burn: 0, protein: 0 };
      }
      if (r.type === 'food') {
        byDate[r.date].intake += r.kcal;
        byDate[r.date].protein += r.protein || 0;
      } else {
        byDate[r.date].burn += r.kcal;
      }
    });
    return Object.values(byDate)
      .map((d) => ({ ...d, protein: Math.round(d.protein * 10) / 10 }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  searchFood(payload) {
    const keyword = (payload.keyword || '').trim();
    if (!keyword) return [];
    return FOOD_DB.filter((f) => f.name.includes(keyword)).slice(0, 20);
  },

  seedFoods() {
    return { added: 0, total: 0, mock: true };
  },

  getQrcode() {
    // 演示模式下没有真实小程序码，海报自动降级为纯文字版
    throw new Error('mock: qrcode unavailable in demo mode');
  },
};

// ---------- 统一调用入口 ----------
// 约定云函数返回格式：{ code: 0, data: {...} } 成功；{ code: 非0, message } 失败
function call(name, data = {}) {
  if (MOCK_MODE) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const action = name === 'login' ? 'login' : data.action;
          const handler = mockHandlers[action];
          if (!handler) {
            reject(new Error(`mock: unknown action ${action}`));
            return;
          }
          resolve(handler(data.payload || data));
        } catch (err) {
          reject(err);
        }
      }, 120);
    });
  }

  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        if (res.result && res.result.code === 0) {
          resolve(res.result.data);
        } else {
          const message = (res.result && res.result.message) || '业务处理失败';
          wx.showToast({ title: message, icon: 'none' });
          reject(new Error(message));
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
        reject(err);
      },
    });
  });
}

function isMock() {
  return MOCK_MODE;
}

module.exports = { call, isMock };
