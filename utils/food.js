// 内置常见食物库（每 100g 的营养数据，来源：中国食物成分表近似值）
// 后续可迁移到云数据库，支持搜索和自定义食物
const FOOD_DB = [
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

// 常见运动消耗预设（按 70kg 体重估算，单位 kcal）
const EXERCISE_PRESETS = [
  { name: '力量训练 60 分钟', kcal: 350 },
  { name: '跑步 30 分钟（8km/h）', kcal: 300 },
  { name: '游泳 30 分钟', kcal: 250 },
  { name: '椭圆机 30 分钟', kcal: 270 },
  { name: '动感单车 45 分钟', kcal: 400 },
  { name: '跳绳 20 分钟', kcal: 240 },
];

// 目标系数：每日目标热量 = 体重(kg) × 系数
const GOAL_OPTIONS = [
  { key: 'cut', label: '减脂', factor: 26, proteinPerKg: 2.0 },
  { key: 'maintain', label: '维持', factor: 32, proteinPerKg: 1.6 },
  { key: 'bulk', label: '增肌', factor: 38, proteinPerKg: 1.8 },
];

// 按克数计算食物热量与营养素
function calcFood(food, grams) {
  const ratio = grams / 100;
  return {
    name: food.name,
    grams,
    kcal: Math.round(food.kcal * ratio),
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    fat: Math.round(food.fat * ratio * 10) / 10,
  };
}

// 计算每日目标（目标热量 + 蛋白质目标）
function calcTarget(weight, goalKey) {
  const goal = GOAL_OPTIONS.find((g) => g.key === goalKey) || GOAL_OPTIONS[1];
  return {
    goalKey: goal.key,
    goalLabel: goal.label,
    targetKcal: Math.round(weight * goal.factor),
    targetProtein: Math.round(weight * goal.proteinPerKg),
  };
}

// 本地日期字符串 YYYY-MM-DD
function todayStr() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

module.exports = { FOOD_DB, EXERCISE_PRESETS, GOAL_OPTIONS, calcFood, calcTarget, todayStr };
