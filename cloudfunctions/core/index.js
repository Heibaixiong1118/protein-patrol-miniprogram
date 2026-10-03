const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 业务路由：通过 event.action 分发
// 集合说明：
//   profiles — {_openid, weight, goalKey, goalLabel, targetKcal, targetProtein, updatedAt}
//   records  — {_openid, type: 'food'|'exercise', name, kcal, protein, carbs, fat, grams, date, createdAt}
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  switch (event.action) {
    // 设置 / 更新身体数据与目标（目标热量由前端按系数算好后传入）
    case 'setProfile': {
      const p = event.payload || {};
      if (!p.weight || !p.targetKcal) {
        return { code: 400, message: '参数不完整' };
      }
      const profiles = db.collection('profiles');
      const exist = await profiles.where({ _openid: OPENID }).get();
      const data = {
        _openid: OPENID,
        weight: p.weight,
        goalKey: p.goalKey || 'maintain',
        goalLabel: p.goalLabel || '维持',
        targetKcal: p.targetKcal,
        targetProtein: p.targetProtein || 0,
        updatedAt: db.serverDate(),
      };
      if (exist.data.length === 0) {
        await profiles.add({ data });
      } else {
        await profiles.doc(exist.data[0]._id).update({ data });
      }
      return { code: 0, data };
    }

    // 新增一条记录（饮食 or 运动）
    case 'add': {
      const r = event.payload || {};
      if (!r.type || !r.name || r.kcal === undefined || !r.date) {
        return { code: 400, message: '参数不完整' };
      }
      await db.collection('records').add({
        data: {
          _openid: OPENID,
          type: r.type,
          name: r.name,
          kcal: Math.round(r.kcal),
          protein: r.protein || 0,
          carbs: r.carbs || 0,
          fat: r.fat || 0,
          grams: r.grams || 0,
          date: r.date,
          createdAt: db.serverDate(),
        },
      });
      return { code: 0, data: { added: true } };
    }

    // 删除一条记录
    case 'remove': {
      const id = event.payload && event.payload.id;
      if (!id) {
        return { code: 400, message: '参数不完整' };
      }
      await db.collection('records').where({ _openid: OPENID, _id: id }).remove();
      return { code: 0, data: { removed: true } };
    }

    // 今日汇总：目标 + 摄入/消耗/营养素合计 + 明细
    case 'today': {
      const date = event.payload && event.payload.date;
      const profiles = await db.collection('profiles').where({ _openid: OPENID }).get();
      const records = await db.collection('records')
        .where({ _openid: OPENID, date })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      const totals = { intake: 0, burn: 0, protein: 0, carbs: 0, fat: 0 };
      records.data.forEach((r) => {
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

      return {
        code: 0,
        data: {
          profile: profiles.data[0] || null,
          totals,
          records: records.data,
        },
      };
    }

    // 近 7 天趋势：每日摄入 / 消耗合计
    case 'history': {
      const days = (event.payload && event.payload.days) || 7;
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);
      const res = await db.collection('records')
        .where({ _openid: OPENID, createdAt: _.gte(since) })
        .limit(500)
        .get();

      const byDate = {};
      res.data.forEach((r) => {
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

      const list = Object.values(byDate)
        .map((d) => ({ ...d, protein: Math.round(d.protein * 10) / 10 }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      return { code: 0, data: list };
    }

    // 搜索食物：从云数据库 foods 集合按名称模糊匹配
    case 'searchFood': {
      const keyword = ((event.payload && event.payload.keyword) || '').trim();
      if (!keyword) {
        return { code: 0, data: [] };
      }
      const res = await db.collection('foods')
        .where({ name: db.RegExp({ regexp: keyword, options: 'i' }) })
        .limit(20)
        .get();
      return { code: 0, data: res.data };
    }

    // 一次性导入内置食物库到 foods 集合（同名食物自动跳过，可安全重复调用）
    // 用法：开发者工具中调用一次 call('core', { action: 'seedFoods' })
    case 'seedFoods': {
      const FOODS = [
        { name: '鸡胸肉', kcal: 133, protein: 19.4, carbs: 2.5, fat: 5.0 },
        { name: '鸡蛋白', kcal: 52, protein: 11.0, carbs: 0.7, fat: 0.2 },
        { name: '鸡蛋（全蛋）', kcal: 144, protein: 13.3, carbs: 2.8, fat: 8.8 },
        { name: '牛肉（瘦）', kcal: 106, protein: 20.2, carbs: 1.2, fat: 2.3 },
        { name: '三文鱼', kcal: 139, protein: 17.2, carbs: 0, fat: 7.8 },
        { name: '虾', kcal: 93, protein: 18.6, carbs: 0.8, fat: 1.0 },
        { name: '米饭（熟）', kcal: 116, protein: 2.6, carbs: 25.9, fat: 0.3 },
        { name: '燕麦片', kcal: 367, protein: 15.0, carbs: 61.6, fat: 6.9 },
        { name: '红薯', kcal: 86, protein: 1.6, carbs: 20.1, fat: 0.1 },
        { name: '全麦面包', kcal: 246, protein: 8.5, carbs: 44.8, fat: 3.4 },
        { name: '西兰花', kcal: 36, protein: 4.1, carbs: 4.3, fat: 0.6 },
        { name: '牛奶', kcal: 54, protein: 3.0, carbs: 3.4, fat: 3.2 },
        { name: '无糖酸奶', kcal: 62, protein: 3.5, carbs: 5.0, fat: 2.8 },
        { name: '香蕉', kcal: 93, protein: 1.4, carbs: 22.0, fat: 0.2 },
        { name: '坚果（混合）', kcal: 607, protein: 20.0, carbs: 21.7, fat: 50.0 },
        { name: '蛋白粉（乳清）', kcal: 380, protein: 75.0, carbs: 8.0, fat: 5.0 },
      ];
      const foods = db.collection('foods');
      let added = 0;
      for (const f of FOODS) {
        const exist = await foods.where({ name: f.name }).count();
        if (exist.total === 0) {
          await foods.add({ data: f });
          added += 1;
        }
      }
      return { code: 0, data: { added, total: FOODS.length } };
    }

    // 生成带渠道参数的小程序码（用于打卡海报）
    // scene=channel_poster → 新用户扫码进入后归因到 poster 渠道
    case 'getQrcode': {
      const res = await cloud.openapi.wxacode.getUnlimited({
        scene: 'channel=poster',
        page: 'pages/index/index',
        width: 280,
        checkPath: false,
        envVersion: 'release',
      });
      // 码图 buffer 存云存储，按用户覆盖，避免重复生成堆积
      const uploaded = await cloud.uploadFile({
        cloudPath: `qrcodes/${OPENID}.png`,
        fileContent: res.buffer,
      });
      return { code: 0, data: { fileID: uploaded.fileID } };
    }

    default:
      return { code: 400, message: 'unknown action' };
  }
};
