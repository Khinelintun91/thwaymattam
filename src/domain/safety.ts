import type { GlucoseReading, Reading, Symptom } from './types.ts';
import { HIGH_GLUCOSE_URGENT_SYMPTOMS, isEmergencySymptom } from './types.ts';
import { isBpCrisis, isGlucoseLow, isGlucoseVeryHigh } from './units.ts';

export type SafetySeverity = 'info' | 'warning' | 'urgent' | 'emergency';

export type SafetyCode =
  | 'emergency-symptoms'
  | 'bp-crisis'
  | 'glucose-low'
  | 'glucose-very-high-urgent'
  | 'glucose-very-high-recheck'
  | 'context-unknown';

export interface SafetyNotice {
  code: SafetyCode;
  severity: SafetySeverity;
  title: string;
  body: string;
}

const VERY_HIGH_WINDOW_MS = 3 * 60 * 60 * 1000;

const EMERGENCY_BODY =
  'ရင်ဘတ်အောင့်ခြင်း၊ မောခြင်း/အသက်ရှူခက်ခြင်း၊ သို့မဟုတ် လေဖြတ်လက္ခဏာ (မျက်နှာငဲ့ခြင်း၊ လက်မအားမရှိခြင်း၊ စကားမပီခြင်း) ရှိလျှင် သွေးပေါင်နှင့် ဂလူးကို့စ်နံပါတ် မည်မျှပင်ဖြစ်ပါစေ အရေးပေါ်ဖြစ်သည်။ ချက်ချင်း အရေးပေါ်အကူအညီယူပါ။ ဆေးပမာဏကို ကိုယ်တိုင်မပြောင်းပါနှင့်။';

const LOW_BODY =
  '၇၀ mg/dL အောက် သို့မဟုတ် ၃.၉ mmol/L အောက်သည် နိမ့်သောသတိပေးချက်ဖြစ်သည်။ ထပ်တိုင်းပါ။ သတိကောင်းစွာရှိပြီး ဘေးကင်းစွာ မျိုချနိုင်မှသာ အမြန်စုပ်ယူနိုင်သော သကြား (သကြား လက်ဖက်ရည်ဇွန်း ၃–၄ ဇွန်းခန့် သို့မဟုတ် ဖျော်ရည်) သောက်နိုင်သည်။ ၁၅ မိနစ်ခန့်အကြာ ထပ်တိုင်းပါ။ သတိလစ်ခြင်း၊ တက်ခြင်း၊ သို့မဟုတ် မျိုချ၍မရလျှင် ပါးစပ်ထဲသို့ ဘာမျှမထည့်ပါနှင့်။ ချက်ချင်း အရေးပေါ်အကူအညီယူပါ။ ဤအက်ပ်သည် အင်ဆူလင် သို့မဟုတ် အခြားဆေးပမာဏကို မညွှန်ပါ။';

function hasSymptom(symptoms: Symptom[], codes: readonly Symptom[]): boolean {
  return symptoms.some((symptom) => codes.includes(symptom));
}

function priorVeryHigh(reading: GlucoseReading, others: Reading[]): boolean {
  const when = Date.parse(reading.recordedAt);
  return others.some((other) => {
    if (other.id === reading.id || other.type !== 'glucose') return false;
    if (!isGlucoseVeryHigh(other.glucoseValue, other.glucoseUnit)) return false;
    const delta = when - Date.parse(other.recordedAt);
    return delta > 0 && delta <= VERY_HIGH_WINDOW_MS;
  });
}

export function evaluateReading(reading: Reading, others: Reading[] = []): SafetyNotice[] {
  const notices: SafetyNotice[] = [];
  if (reading.symptoms.some(isEmergencySymptom)) {
    notices.push({
      code: 'emergency-symptoms',
      severity: 'emergency',
      title: 'အရေးပေါ်လက္ခဏာ',
      body: EMERGENCY_BODY,
    });
  }

  if (reading.type === 'bp' && isBpCrisis(reading.systolic, reading.diastolic)) {
    notices.push(bpCrisisNotice());
  }

  if (reading.type === 'glucose') {
    notices.push(...glucoseNotices(reading, others));
  }

  const elevated = notices.some((notice) => notice.severity !== 'info');
  if (reading.type === 'glucose' && reading.mealContext === 'unknown' && !elevated) {
    notices.push({
      code: 'context-unknown',
      severity: 'info',
      title: 'အစာစားချိန် မသိပါ',
      body: 'ဤတန်ဖိုးကို ပုံမှန် သို့မဟုတ် မပုံမှန်ဟု မသတ်မှတ်ပါ။ နံနက်၊ နေ့လယ်၊ ညနေ၊ ည ဟူသော အချိန်အမည်သည် အစာရှောင်ခြင်းကို မဆိုလိုပါ။',
    });
  }

  return notices;
}

function bpCrisisNotice(): SafetyNotice {
  return {
    code: 'bp-crisis',
    severity: 'urgent',
    title: 'သွေးပေါင် အလွန်မြင့်နေသည်',
    body: 'အပေါ်သွေးပေါင် ၁၈၀ ထက်များခြင်း သို့မဟုတ် အောက်သွေးပေါင် ၁၂၀ ထက်များခြင်းဖြစ်သည်။ ငြိမ်ငြိမ်ထိုင်ပြီး မိနစ်အနည်းငယ်အကြာ ထပ်တိုင်းပါ။ ထပ်မြင့်နေလျှင် သို့မဟုတ် လက္ခဏာရှိလျှင် အရေးပေါ်ဆေးကုသမှု ခံယူပါ။ ရင်ဘတ်အောင့်၊ မော၊ လေဖြတ်လက္ခဏာရှိလျှင် နံပါတ်ကို မစောင့်ဘဲ ချက်ချင်း အရေးပေါ်အကူအညီယူပါ။ ဆေးပမာဏကို ကိုယ်တိုင်မပြောင်းပါနှင့်။',
  };
}

function glucoseNotices(reading: GlucoseReading, others: Reading[]): SafetyNotice[] {
  const notices: SafetyNotice[] = [];
  if (isGlucoseLow(reading.glucoseValue, reading.glucoseUnit)) {
    const confused = reading.symptoms.includes('confusion');
    notices.push({
      code: 'glucose-low',
      severity: 'warning',
      title: 'သွေးဂလူးကို့စ် နိမ့်နေသည်',
      body: confused
        ? `${LOW_BODY} ဇဝေဇဝါဖြစ်နေလျှင် ပါးစပ်မှ အစာအရည် မတိုက်ပါနှင့်။`
        : LOW_BODY,
    });
  }

  if (isGlucoseVeryHigh(reading.glucoseValue, reading.glucoseUnit)) {
    const symptomUrgent = hasSymptom(reading.symptoms, HIGH_GLUCOSE_URGENT_SYMPTOMS);
    const persistent = priorVeryHigh(reading, others);
    if (symptomUrgent || persistent) {
      notices.push({
        code: 'glucose-very-high-urgent',
        severity: 'urgent',
        title: 'သွေးဂလူးကို့စ် အလွန်မြင့်ပြီး အရေးကြီးသည်',
        body: '၃၀၀ mg/dL သို့မဟုတ် ၁၆.၇ mmol/L နှင့်အထက် ဆက်တိုက်ဖြစ်ခြင်း၊ အန်ခြင်း၊ နက်နက်ရှိုင်းရှိုင်း အသက်ရှူခြင်း၊ သို့မဟုတ် ဇဝေဇဝါဖြစ်ခြင်းသည် အရေးပေါ်ကုသမှု လိုအပ်နိုင်သည်။ ချက်ချင်း ဆေးကုသမှုခံယူပါ။ ဤအက်ပ်သည် အင်ဆူလင်ပမာဏကို မညွှန်ပါ။',
      });
    } else {
      notices.push({
        code: 'glucose-very-high-recheck',
        severity: 'warning',
        title: 'သွေးဂလူးကို့စ် အလွန်မြင့်နေသည်',
        body: 'တစ်ကြိမ်တန်ဖိုး ၃၀၀ mg/dL သို့မဟုတ် ၁၆.၇ mmol/L နှင့်အထက် ဖြစ်နေသည်။ ထပ်တိုင်းပါ။ ဆက်တိုက်မြင့်နေလျှင်၊ အန်လျှင်၊ နက်နက်ရှိုင်းရှိုင်း အသက်ရှူလျှင်၊ ဇဝေဇဝါဖြစ်လျှင် အရေးပေါ်ကုသမှုခံယူပါ။ ဆေးပမာဏကို ကိုယ်တိုင်မပြောင်းပါနှင့်။',
      });
    }
  }
  return notices;
}

export type SafetyBadge = 'emergency' | 'urgent' | 'warning' | 'info' | 'none';

/** `none` means no safety flag. It is not a normal result. */
export function badgeFor(notices: SafetyNotice[]): SafetyBadge {
  if (notices.some((notice) => notice.severity === 'emergency')) return 'emergency';
  if (notices.some((notice) => notice.severity === 'urgent')) return 'urgent';
  if (notices.some((notice) => notice.severity === 'warning')) return 'warning';
  if (notices.some((notice) => notice.severity === 'info')) return 'info';
  return 'none';
}

export function badgeLabel(badge: SafetyBadge): string | null {
  switch (badge) {
    case 'emergency':
      return 'အရေးပေါ်';
    case 'urgent':
      return 'အရေးကြီး';
    case 'warning':
      return 'သတိ';
    case 'info':
      return 'အခြေအနေမသိ';
    case 'none':
      return null;
  }
}
