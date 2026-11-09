import type { DayPart, MealContext, Symptom } from './types.ts';

export const MEAL_LABEL: Record<MealContext, string> = {
  fasting: 'အစာရှောင်',
  premeal: 'အစာမစားမီ',
  postmeal: 'အစာစားပြီး',
  random: 'ကြုံသလို',
  unknown: 'မသိ',
};

export const DAYPART_LABEL: Record<DayPart, string> = {
  morning: 'နံနက်',
  afternoon: 'နေ့လယ်',
  evening: 'ညနေ',
  night: 'ည',
};

export const DAYPART_RANGE: Record<DayPart, string> = {
  morning: '၀၅:၀၀–၁၁:၅၉',
  afternoon: '၁၂:၀၀–၁၆:၅၉',
  evening: '၁၇:၀၀–၂၀:၅၉',
  night: '၂၁:၀၀–၀၄:၅၉',
};

export const SYMPTOM_LABEL: Record<Symptom, string> = {
  chest_pain: 'ရင်ဘတ်အောင့်',
  dyspnea: 'မော / အသက်ရှူခက်',
  stroke_signs: 'လေဖြတ်လက္ခဏာ',
  vomiting: 'အန်',
  deep_breathing: 'နက်နက်ရှိုင်းရှိုင်း အသက်ရှူ',
  confusion: 'ဇဝေဇဝါ',
  sweating: 'ချွေးထွက်',
  shaking: 'တုန်',
  dizziness: 'ခေါင်းမူး',
  headache: 'ခေါင်းကိုက်',
  weakness: 'ကိုယ်လက်အားနည်း',
};

export const MONTHS_MY = [
  'ဇန်နဝါရီ',
  'ဖေဖော်ဝါရီ',
  'မတ်',
  'ဧပြီ',
  'မေ',
  'ဇွန်',
  'ဇူလိုင်',
  'ဩဂုတ်',
  'စက်တင်ဘာ',
  'အောက်တိုဘာ',
  'နိုဝင်ဘာ',
  'ဒီဇင်ဘာ',
] as const;
