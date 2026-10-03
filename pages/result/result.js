const { call } = require('../../utils/cloud');
const { todayStr } = require('../../utils/food');

// TODO: 在 mp 后台「订阅消息」中申请模板后替换（建议选「打卡提醒」类模板）
const TEMPLATE_ID = 'YOUR_SUBSCRIBE_TEMPLATE_ID';

Page({
  data: {
    date: todayStr(),
    profile: null,
    totals: { intake: 0, burn: 0, protein: 0, carbs: 0, fat: 0 },
    gap: 0,
    proteinPerKg: 0,
    verdict: '',
    loading: true,
  },

  onShow() {
    this.loadAnalysis();
  },

  async loadAnalysis() {
    try {
      const data = await call('core', { action: 'today', payload: { date: this.data.date } });
      const { profile, totals } = data;

      let gap = 0;
      let proteinPerKg = 0;
      let verdict = '先去设置目标并记录今天的第一餐吧';
      if (profile) {
        // 热量缺口 = 目标 - 摄入 + 运动消耗（正数=缺口，负数=盈余）
        gap = profile.targetKcal - totals.intake + totals.burn;
        proteinPerKg = Math.round((totals.protein / profile.weight) * 10) / 10;

        if (profile.goalKey === 'cut') {
          verdict = gap > 200 ? '缺口不错，保持住' : '缺口偏小，晚餐注意控制';
        } else if (profile.goalKey === 'bulk') {
          verdict = gap < 0 && proteinPerKg >= 1.6 ? '盈余和蛋白质都到位了' : '还没吃够，加餐安排上';
        } else {
          verdict = Math.abs(gap) < 200 ? '今天热量很平衡' : '和维持目标有偏差，注意调整';
        }
      }

      this.setData({ profile, totals, gap, proteinPerKg, verdict, loading: false });
    } catch (err) {
      console.error('load analysis failed', err);
      this.setData({ loading: false });
    }
  },

  // ---------- 打卡海报 ----------
  async onMakePoster() {
    const { profile, totals, gap, proteinPerKg, verdict, date } = this.data;
    if (!profile) {
      wx.showToast({ title: '先回首页设置目标', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '生成海报中…', mask: true });
    try {
      const canvas = await new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          .in(this)
          .select('#posterCanvas')
          .fields({ node: true, size: true })
          .exec((res) => (res[0] ? resolve(res[0].node) : reject(new Error('canvas not found'))));
      });

      const ctx = canvas.getContext('2d');
      const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const dpr = sysInfo.pixelRatio || 2;
      const W = 375;
      const H = 640;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      // 小程序码：失败（如未发布版 page 校验不过）时降级为纯文字海报
      let qrcodeImg = null;
      try {
        const { fileID } = await call('core', { action: 'getQrcode' });
        const tempPath = await new Promise((resolve, reject) => {
          wx.cloud.downloadFile({ fileID, success: (r) => resolve(r.tempFilePath), fail: reject });
        });
        qrcodeImg = canvas.createImage();
        await new Promise((resolve, reject) => {
          qrcodeImg.onload = resolve;
          qrcodeImg.onerror = reject;
          qrcodeImg.src = tempPath;
        });
      } catch (err) {
        console.warn('qrcode skipped', err);
      }

      this.drawPoster(ctx, W, H, { profile, totals, gap, proteinPerKg, verdict, date, qrcodeImg });

      const tempFilePath = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          success: (res) => resolve(res.tempFilePath),
          fail: reject,
        });
      });

      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({ filePath: tempFilePath, success: resolve, fail: reject });
      });

      wx.hideLoading();
      wx.showToast({ title: '已存相册，去朋友圈晒战绩', icon: 'none' });
    } catch (err) {
      wx.hideLoading();
      console.error('make poster failed', err);
      if (err.errMsg && err.errMsg.includes('auth')) {
        // 相册授权被拒绝过，引导去设置页开启
        wx.showModal({
          title: '需要相册权限',
          content: '开启后才能保存打卡海报',
          confirmText: '去开启',
          success: (res) => res.confirm && wx.openSetting(),
        });
      } else {
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      }
    }
  },

  // 海报绘制：白底 + 顶部主题条 + 缺口大数字 + 营养素 + 小程序码引导
  drawPoster(ctx, W, H, { profile, totals, gap, proteinPerKg, verdict, date, qrcodeImg }) {
    const GREEN = '#07C160';
    const ORANGE = '#FA9D3B';
    const TEXT = '#1A1A1A';
    const MUTED = '#888888';

    // 背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // 顶部主题条
    ctx.fillStyle = GREEN;
    ctx.fillRect(0, 0, W, 88);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('健身热量打卡', 24, 38);
    ctx.font = '13px sans-serif';
    ctx.fillText(`${date} · ${profile.goalLabel}目标`, 24, 64);

    // 热量缺口大数字
    const isGap = gap >= 0;
    ctx.textAlign = 'center';
    ctx.fillStyle = MUTED;
    ctx.font = '15px sans-serif';
    ctx.fillText(isGap ? '今日热量缺口' : '今日热量盈余', W / 2, 160);
    ctx.fillStyle = isGap ? GREEN : ORANGE;
    ctx.font = 'bold 88px sans-serif';
    ctx.fillText(`${Math.abs(gap)}`, W / 2, 252);
    ctx.fillStyle = MUTED;
    ctx.font = '13px sans-serif';
    ctx.fillText('kcal', W / 2, 280);

    // 分隔线
    ctx.strokeStyle = '#F0F0F0';
    ctx.beginPath();
    ctx.moveTo(32, 312);
    ctx.lineTo(W - 32, 312);
    ctx.stroke();

    // 三项数据
    const stats = [
      { label: '摄入', value: `${totals.intake}`, unit: 'kcal' },
      { label: '运动消耗', value: `${totals.burn}`, unit: 'kcal' },
      { label: '蛋白质', value: `${totals.protein}`, unit: 'g' },
    ];
    stats.forEach((s, i) => {
      const x = (W / 3) * i + W / 6;
      ctx.fillStyle = TEXT;
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(s.value, x, 360);
      ctx.fillStyle = MUTED;
      ctx.font = '12px sans-serif';
      ctx.fillText(`${s.label} ${s.unit}`, x, 384);
    });

    // 蛋白质达成
    ctx.fillStyle = '#576B95';
    ctx.font = '14px sans-serif';
    ctx.fillText(`蛋白质 ${proteinPerKg} g/kg · 目标 ${profile.targetProtein}g`, W / 2, 424);

    // 一句话点评
    ctx.fillStyle = TEXT;
    ctx.font = '15px sans-serif';
    ctx.fillText(verdict, W / 2, 458);

    // 底部小程序码（有码画图，无码画引导文字）
    if (qrcodeImg) {
      ctx.drawImage(qrcodeImg, W / 2 - 45, 478, 90, 90);
      ctx.fillStyle = MUTED;
      ctx.font = '12px sans-serif';
      ctx.fillText('长按识别小程序码，一起记录热量', W / 2, 600);
    } else {
      ctx.fillStyle = MUTED;
      ctx.font = '12px sans-serif';
      ctx.fillText('搜索小程序，一起记录热量', W / 2, 520);
    }
    ctx.textAlign = 'left';
  },

  // 授权时机：用户看到分析结果、感知到价值后再弹订阅授权
  onSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID],
      success: (res) => {
        if (res[TEMPLATE_ID] === 'accept') {
          wx.showToast({ title: '已开启每日提醒', icon: 'success' });
        }
      },
      fail: (err) => console.error('subscribe failed', err),
    });
  },

  onShareAppMessage() {
    const { totals, gap } = this.data;
    return {
      title: `今日摄入 ${totals.intake} kcal，热量缺口 ${gap}，你呢？`,
      path: '/pages/index/index?channel=share_result',
    };
  },

  onShareTimeline() {
    return {
      title: '每天算清热量缺口，增肌减脂不迷路',
      query: 'channel=moments_result',
    };
  },
});
