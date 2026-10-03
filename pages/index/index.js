const { call } = require('../../utils/cloud');
const { FOOD_DB, EXERCISE_PRESETS, GOAL_OPTIONS, calcFood, calcTarget, todayStr } = require('../../utils/food');

Page({
  data: {
    date: todayStr(),
    profile: null,
    totals: { intake: 0, burn: 0, protein: 0, carbs: 0, fat: 0 },
    records: [],
    // 目标设置
    weight: '',
    goalIndex: 0,
    goalLabels: GOAL_OPTIONS.map((g) => g.label),
    // 添加食物
    foodIndex: 0,
    foodNames: FOOD_DB.map((f) => f.name),
    grams: '',
    // 食物搜索（云端食物库，未命中时回退本地 picker）
    keyword: '',
    searchResults: [],
    selectedFood: null,
    // 添加运动
    exerciseIndex: 0,
    exerciseNames: EXERCISE_PRESETS.map((e) => `${e.name}（约${e.kcal} kcal）`),
    submitting: false,
  },

  onShow() {
    this.loadToday();
  },

  async loadToday() {
    try {
      const data = await call('core', { action: 'today', payload: { date: this.data.date } });
      this.setData({
        profile: data.profile,
        totals: data.totals,
        records: data.records,
      });
    } catch (err) {
      console.error('load today failed', err);
    }
  },

  // ---------- 目标设置 ----------
  onWeightInput(e) {
    this.setData({ weight: e.detail.value });
  },

  onGoalChange(e) {
    this.setData({ goalIndex: Number(e.detail.value) });
  },

  async onSaveProfile() {
    const weight = parseFloat(this.data.weight);
    if (!weight || weight <= 0) {
      wx.showToast({ title: '请输入有效体重', icon: 'none' });
      return;
    }
    const goal = GOAL_OPTIONS[this.data.goalIndex];
    const target = calcTarget(weight, goal.key);
    this.setData({ submitting: true });
    try {
      const profile = await call('core', {
        action: 'setProfile',
        payload: { weight, ...target },
      });
      this.setData({ profile });
      wx.showToast({ title: '目标已保存', icon: 'success' });
    } catch (err) {
      console.error('save profile failed', err);
    }
    this.setData({ submitting: false });
  },

  // ---------- 添加食物 ----------
  onFoodChange(e) {
    this.setData({ foodIndex: Number(e.detail.value), selectedFood: null });
  },

  onGramsInput(e) {
    this.setData({ grams: e.detail.value });
  },

  // 搜索云端食物库（输入即搜，300ms 防抖）
  onKeywordInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (!keyword.trim()) {
      this.setData({ searchResults: [] });
      return;
    }
    this.searchTimer = setTimeout(async () => {
      try {
        const results = await call('core', {
          action: 'searchFood',
          payload: { keyword: keyword.trim() },
        });
        this.setData({ searchResults: results });
      } catch (err) {
        console.error('search food failed', err);
      }
    }, 300);
  },

  // 从搜索结果中选中食物
  onSelectFood(e) {
    const { index } = e.currentTarget.dataset;
    const food = this.data.searchResults[index];
    this.setData({
      selectedFood: food,
      searchResults: [],
      keyword: '',
    });
  },

  onClearSelected() {
    this.setData({ selectedFood: null });
  },

  async onAddFood() {
    const grams = parseFloat(this.data.grams);
    if (!grams || grams <= 0) {
      wx.showToast({ title: '请输入克数', icon: 'none' });
      return;
    }
    // 优先用搜索选中的云端食物，否则用本地 picker 选中的内置食物
    const food = this.data.selectedFood || FOOD_DB[this.data.foodIndex];
    const item = calcFood(food, grams);
    await this.addRecord({ type: 'food', ...item });
    this.setData({ grams: '', selectedFood: null });
  },

  // ---------- 添加运动 ----------
  onExerciseChange(e) {
    this.setData({ exerciseIndex: Number(e.detail.value) });
  },

  async onAddExercise() {
    const preset = EXERCISE_PRESETS[this.data.exerciseIndex];
    await this.addRecord({ type: 'exercise', name: preset.name, kcal: preset.kcal });
  },

  async addRecord(record) {
    this.setData({ submitting: true });
    try {
      await call('core', {
        action: 'add',
        payload: { ...record, date: this.data.date },
      });
      await this.loadToday();
    } catch (err) {
      console.error('add record failed', err);
    }
    this.setData({ submitting: false });
  },

  async onRemove(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await call('core', { action: 'remove', payload: { id } });
      await this.loadToday();
    } catch (err) {
      console.error('remove record failed', err);
    }
  },

  goAnalysis() {
    wx.navigateTo({ url: '/pages/result/result' });
  },

  goCenter() {
    wx.navigateTo({ url: '/subpackages/user/pages/center/center' });
  },

  onShareAppMessage() {
    return {
      title: '健身党都在用的热量记录工具，蛋白质一目了然',
      path: '/pages/index/index?channel=share_index',
    };
  },

  onShareTimeline() {
    return {
      title: '记录热量和蛋白质，增肌减脂都够用',
      query: 'channel=moments_index',
    };
  },
});
