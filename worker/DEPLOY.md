# راهنمای استقرار MLB Alert Bot روی Cloudflare Workers

این سند مراحل راه‌اندازی و استقرار نسخه Cloudflare Workers ربات اعلان‌های MLB را توضیح می‌دهد.

---

## پیش‌نیازها

- [Node.js](https://nodejs.org/) نسخه 18 یا بالاتر
- یک حساب [Cloudflare](https://dash.cloudflare.com/) (رایگان)
- یک [ربات تلگرام](https://t.me/BotFather) و توکن آن
- یک کانال تلگرام (آیدی کانال)

---

## ۱. نصب وابستگی‌ها

```bash
cd worker
npm install
```

این دستور `wrangler` (نسخه ۴) و `esbuild` (برای باندل کردن) را نصب می‌کند.

---

## ۲. ایجاد KV Namespace

Cloudflare KV برای ذخیره وضعیت بازی‌ها و جلوگیری از ارسال پیام تکراری استفاده می‌شود.

```bash
npx wrangler kv namespace create MLB_STATE --binding MLB_STATE --update-config
```

این دستور:
- یک KV namespace جدید با نام `MLB_STATE` می‌سازد
- آن را با binding name `MLB_STATE` به Worker متصل می‌کند
- به‌طور خودکار `wrangler.toml` را به‌روز می‌کند

> اگر فایل `wrangler.toml` وجود نداشت، دستور بالا آن را می‌سازد. از آنجایی که ما از قبل `wrangler.toml` داریم، فقط مقدار `id` در آن به‌روز می‌شود.

---

## ۳. تنظیم سکرت‌ها (رمزهای امن)

> **مهم:** تمام دستورات wrangler باید از داخل پوشه `worker/` اجرا شوند.

```bash
cd worker
npx wrangler secret put TELEGRAM_BOT_TOKEN
# سپس توکن ربات را وارد کنید (از @BotFather)

npx wrangler secret put TELEGRAM_CHANNEL_ID
# سپس آیدی کانال را وارد کنید (مثلاً @channelusername یا -1001234567890)
```

> **نکته:** سکرت‌ها در Cloudflare به صورت رمزنگاری‌شده ذخیره می‌شوند و در کد در دسترس `env.TELEGRAM_BOT_TOKEN` و `env.TELEGRAM_CHANNEL_ID` قرار می‌گیرند.

---

## ۴. بیلد (باندل کردن به یک فایل)

برای باندل کردن کل Worker به یک فایل واحد:

```bash
npm run build
```

خروجی در `dist/worker.js` ذخیره می‌شود. این فایل شامل تمام کدها بدون وابستگی خارجی است و می‌توانید آن را مستقیماً در داشبورد Cloudflare آپلود کنید.

> **نکته:** wrangler 4 به‌صورت پیش‌فرض کدها را خودش باندل می‌کند (`--no-bundle` برای غیرفعال کردن). اما اسکریپت `build.js` با esbuild این کار را انجام می‌دهد تا کنترل بیشتری روی خروجی داشته باشید.

---

## ۵. استقرار (Deploy)

> **مهم:** تمام دستورات wrangler باید از داخل پوشه `worker/` اجرا شوند.

### روش اول: استفاده از Wrangler (پیشنهادی)

```bash
cd worker
npx wrangler deploy
```

wrangler 4 به‌طور خودکار:
- کدها را باندل می‌کند
- Worker را آپلود می‌کند
- KV namespace را متصل می‌کند
- متغیرهای محیطی (غیرسکرت) را از `wrangler.toml` می‌خواند

### روش دوم: آپلود دستی در داشبورد Cloudflare

1. وارد [داشبورد Cloudflare Workers](https://dash.cloudflare.com/) شوید
2. روی **Create Worker** کلیک کنید
3. نام worker را `mlb-alert-bot` بگذارید
4. محتوای فایل `dist/worker.js` را در ویرایشگر کپی کنید
5. در تب **Settings > Variables**:
   - سکرت‌های `TELEGRAM_BOT_TOKEN` و `TELEGRAM_CHANNEL_ID` را اضافه کنید
   - متغیرهای محیطی (در صورت نیاز) را تنظیم کنید
6. در تب **Settings > KV**، KV namespace ایجاد شده را به worker متصل کنید
7. روی **Save and Deploy** کلیک کنید

---

## ۶. اندپوینت‌های HTTP

Worker دارای سه مسیر (route) مختلف است:

| مسیر | متد | توضیح |
|-------|------|------|
| `GET /` | GET | اجرای موتور اعلان‌ها (مشابه cron job) |
| `GET /reset` | GET | پاک کردن تمام وضعیت‌ها و اجرای مجدد موتور (اسکن کامل همه بازی‌ها از اول) |
| `POST /reset` | POST | فقط پاک کردن وضعیت‌ها بدون اجرای موتور (برای ریست دستی) |

### موارد استفاده از `/reset`

- اگر Worker دچار مشکل شد و نیاز به اسکن مجدد همه بازی‌ها داشتید
- اگر اعلان‌ها به درستی ارسال نشدند و می‌خواهید از نو شروع کنید
- بعد از ریست، Worker مثل روز اول همه بازی‌ها را اسکن می‌کند و اعلان‌های لازم را ارسال می‌کند

مثال با curl:
```bash
# ریست کامل + اجرای مجدد
curl -X GET https://mlb-alert-bot.your-subdomain.workers.dev/reset

# فقط ریست (بدون اجرا)
curl -X POST https://mlb-alert-bot.your-subdomain.workers.dev/reset
```

---

## ۷. تنظیم زمان‌بندی (Cron Job)

Worker از طریق HTTP قابل فراخوانی است. کافیست یک درخواست GET به آدرس Worker خود ارسال کنید:

```
https://mlb-alert-bot.your-subdomain.workers.dev
```

می‌توانید از هر سرویس Cron Job خارجی (مثل cron-job.org، GitHub Actions، یا سرور شخصی) استفاده کنید که هر ۱۵ دقیقه یک درخواست GET به این آدرس بزند.

> اگر ترجیح می‌دهید از Cron Trigger داخلی Cloudflare استفاده کنید، خطوط مربوط به `[triggers]` را در `wrangler.toml` از حالت کامنت خارج کنید و مجدداً دیپلوی کنید.

---

## ۸. تست Worker به صورت محلی

```bash
cd worker
npx wrangler dev
```

سپس در مرورگر به `http://localhost:8787` بروید تا Worker اجرا شود.

---

## ساختار فایل‌ها

```
worker/
├── src/
│   ├── index.js              # ورودی Worker (HTTP + Scheduled)
│   ├── config.js              # خواندن تنظیمات از env
│   ├── db/
│   │   └── repository.js      # ذخیره‌سازی در KV
│   ├── mlb/
│   │   ├── client.js          # دریافت اطلاعات از API MLB
│   │   └── parser.js          # پردازش داده‌های MLB
│   ├── telegram/
│   │   └── sender.js          # ارسال پیام به تلگرام
│   ├── messages/
│   │   └── templates.js       # قالب پیام‌ها
│   ├── notifications/
│   │   └── engine.js          # موتور اصلی اعلان‌ها
│   └── utils/
│       ├── time.js            # توابع زمان
│       └── logger.js          # لاگر ساده
├── dist/
│   └── worker.js              # خروجی بیلد (یک فایل)
├── build.js                   # اسکریپت بیلد با esbuild
├── package.json
├── wrangler.toml              # تنظیمات Cloudflare
├── .env.example               # نمونه متغیرهای محیطی
└── DEPLOY.md                  # این فایل
```

---

## متغیرهای محیطی

| متغیر | اجباری | توضیح |
|--------|---------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | توکن ربات تلگرام از @BotFather (به‌صورت سکرت) |
| `TELEGRAM_CHANNEL_ID` | ✅ | آیدی کانال تلگرام (به‌صورت سکرت) |
| `MLB_API_BASE_URL` | ❌ | آدرس API MLB (پیش‌فرض: `https://statsapi.mlb.com/api/v1`) |
| `NOTIFY_24H` | ❌ | فعال/غیرفعال اعلان ۲۴ ساعت قبل (پیش‌فرض: `true`) |
| `NOTIFY_2H` | ❌ | فعال/غیرفعال اعلان ۲ ساعت قبل (پیش‌فرض: `true`) |
| `NOTIFY_GAME_START` | ❌ | فعال/غیرفعال اعلان شروع مسابقه (پیش‌فرض: `false`) |
| `NOTIFY_GAME_END` | ❌ | فعال/غیرفعال اعلان پایان مسابقه (پیش‌فرض: `true`) |
| `TIMEZONE` | ❌ | منطقه زمانی برای نمایش ساعت (پیش‌فرض: `Asia/Tehran`) |
| `LOOKAHEAD_DAYS` | ❌ | تعداد روزهای بررسی مسابقات (پیش‌فرض: `3`) |

> **نکته امنیتی:** `TELEGRAM_BOT_TOKEN` و `TELEGRAM_CHANNEL_ID` باید به صورت **سکرت** تنظیم شوند، نه متغیر محیطی معمولی. از دستور `npx wrangler secret put` استفاده کنید.

---

## عیب‌یابی

**مشکل:** Worker خطا می‌دهد: `Telegram bot token or channel ID not configured`
**راه‌حل:** مطمئن شوید سکرت‌ها را با `npx wrangler secret put` تنظیم کرده‌اید.

**مشکل:** خطای `KV namespace not found`
**راه‌حل:** مطمئن شوید KV namespace را ایجاد کرده و `id` آن در `wrangler.toml` درست است. از دستور `npx wrangler kv namespace list` برای دیدن namespaceهای موجود استفاده کنید.

**مشکل:** Worker تایم اوت می‌خورد
**راه‌حل:** Workerهای رایگان Cloudflare محدودیت ۱۰ ثانیه دارند. اگر Worker بیشتر طول بکشد، می‌توانید از `ctx.waitUntil()` استفاده کنید یا طرح پرداختی تهیه کنید.

**مشکل:** لاگ‌ها در داشبورد Cloudflare دیده نمی‌شوند
**راه‌حل:** مطمئن شوید بخش `[observability]` در `wrangler.toml` فعال است. لاگ‌ها در تب **Logs** داشبورد Worker قابل مشاهده هستند.

**مشکل:** دستور wrangler کار نمی‌کند
**راه‌حل:** مطمئن شوید نسخه wrangler 4 نصب است: `npx wrangler --version`. اگر نه، با `npm install -g wrangler` یا `npm install wrangler@latest` به‌روز کنید.
