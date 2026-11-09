# သွေးမှတ်တမ်း

ဖုန်းထဲတွင်သာ သိမ်းသော သွေးဂလူးကို့စ်နှင့် သွေးပေါင်ချိန် မှတ်တမ်း။ ဓာတ်ပုံမှ ဖတ်ခြင်း၊ လက်ဖြင့်ထည့်ခြင်း၊ နေ့အလိုက်မှတ်တမ်း၊ ဂရပ်နှင့် ဆရာဝန်အတွက် ပရင့်အနှစ်ချုပ် ပါသည်။

A mobile-first Burmese log for blood glucose and blood pressure. It does not diagnose and does not suggest a dose.

Site: [https://khinelintun91.github.io/thwaymattam/](https://khinelintun91.github.io/thwaymattam/)

## ဒေတာ ဘယ်ရောက်သလဲ

မှတ်တမ်းသည် ဖုန်းဘရောက်ဇာ၏ `localStorage` ထဲတွင်သာ ရှိသည်။ ဂလူးကို့စ်၊ သွေးပေါင်၊ မှတ်ချက်နှင့် ဓာတ်ပုံကို ဆာဗာသို့ မပို့ပါ။ အကောင့်မရှိပါ။ အလိုအလျောက် ချိန်ကိုက်ခြင်း မရှိပါ။ ဘရောက်ဇာဒေတာ သို့မဟုတ် အက်ပ်ကို ဖျက်လျှင် မှတ်တမ်းပါ ပျောက်သည်။

Health data stays in that phone’s browser `localStorage`. Nothing is uploaded. There is no account and no automatic sync. Clearing the browser’s site data deletes the log.

နမူနာခလုတ်သည် တကယ်လူနာမှတ်တမ်း မဟုတ်ပါ။ ဤရီပိုတွင် လူနာတကယ်၏ ကိန်းများ မပါပါ။

## ဖုန်းပင်မစာမျက်နှာတွင် ထည့်ရန်

ပထမအကြိမ် ဖွင့်သောအခါ အက်ပ်နှင့် OCR ဖိုင် (ခန့်မှန်း ၇.၄ MB) ကို ဒေါင်းလုဒ်လုပ်သည်။ ထို့နောက် အင်တာနက်မလိုဘဲ မှတ်တမ်းတင်နိုင်သည်။

- Android (Chrome): မီနူး → **Add to Home screen** သို့မဟုတ် **Install app**။
- iPhone (Safari): Share ခလုတ် → **Add to Home Screen**။

Open the site once so the app files download. On Android Chrome, use the menu and choose Add to Home screen or Install app. On iPhone Safari, tap Share, then Add to Home Screen.

## ဖုန်းနှစ်လုံးကြား မှတ်တမ်းရွှေ့ရန်

1. မှတ်တမ်းရှိသောဖုန်းတွင် **ဖုန်းတစ်လုံးဆီ ပို့ရန်** ကို နှိပ်ပါ။ မျှဝေစာမျက်နှာ ပွင့်လျှင် Viber သို့မဟုတ် Telegram ကို ရွေးပါ။ မပွင့်လျှင် `thwaymattam-backup-YYYY-MM-DD.json` ဖိုင်ကို ဒေါင်းလုဒ်လုပ်ပြီး ထိုဖိုင်ကို ပို့ပါ။
2. လက်ခံသောဖုန်းတွင် **အခြားဖုန်းမှ ယူမည်** သို့မဟုတ် **ပိုမို → JSON သွင်းမည်** ကို နှိပ်ပါ။
3. **ပေါင်းထည့်မည်** ကို နှိပ်ပါ။ ဒါသည် ပုံမှန်နည်းလမ်းဖြစ်သည်။
4. တူညီသောဖိုင်ကို ဒုတိယအကြိမ် သွင်းလျှင်၊ သို့မဟုတ် ဖုန်းနှစ်လုံးကြား ပြန်ပို့လျှင်၊ ရှိပြီးသား မှတ်တမ်းကို ထပ်မတည်ပါ။ ပြင်ထားသော မှတ်တမ်းသည် နောက်ဆုံးအချိန်ကို ယူသည်။ မျက်နှာပြင်တွင် အသစ်ဘယ်နှစ်ခု၊ ရှိပြီးသားဘယ်နှစ်ခု ပြပါသည်။

On the phone that has the log, tap **ဖုန်းတစ်လုံးဆီ ပို့ရန်**. If the share sheet opens, send the file with Viber or Telegram. If it does not, the file `thwaymattam-backup-YYYY-MM-DD.json` downloads and you can send that. On the other phone, open **ပိုမို**, choose **JSON သွင်းမည်**, then **ပေါင်းထည့်မည်**. Importing the same file again, or sending it back, does not duplicate records.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:47231. `npm test` runs the checks. `npm run build` writes `dist/`. The local build uses a relative base. The GitHub Pages workflow sets `VITE_BASE_PATH=/thwaymattam/`.
