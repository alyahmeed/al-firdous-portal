# ربط الموقع بقاعدة بيانات MongoDB

الفكرة: الموقع نفسه ملفات ثابتة على GitHub Pages، فلا يمكنه التحدث مع MongoDB مباشرة.
لذلك أضفنا **API صغير** (Node.js) يعمل على Vercel المجاني، وهو الوحيد الذي يتصل بقاعدة البيانات.

```
المتصفح (GitHub Pages / Vercel)
        │  GET /api كل 10 ثوانٍ  +  POST عند الإضافة/التعديل/الحذف
        ▼
   Vercel Serverless  ──►  MongoDB Atlas (M0 مجاني)
```

## ما تم إضافته في المشروع

| الملف | الوظيفة |
|---|---|
| `api/index.js` | دالة Vercel: `GET /api` لقراءة البيانات و`POST /api` للإضافة/التعديل/الحذف/الاستبدال |
| `server/lib.js` | طبقة MongoDB المشتركة (اتصال، تحقق من الحقول، توليد أرقام تسلسلية) |
| `server/local.js` | سيرفر محلي يعرض الموقع + نفس الـ API (للتجربة) |
| `scripts/migrate.js` | نقل البيانات الحالية من ملف JSON إلى MongoDB |
| `vercel.json` | إعدادات دالة Vercel |
| `seed.json` | نسخة البيانات الحالية — **مستبعدة من git** (تحتوي بيانات شخصية) |

الـ API محمي بـ `secret` (نفس القيمة `CHANGE_ME_123` الموجودة في الصفحة). غيّرها في مكانين:
في Vercel (`API_SECRET`) وفي `index.html` (`API.secret`).

---

## 1) التجربة محليًا (تمت بالفعل ✅)

```powershell
cd "C:\Users\Ali\Documents\Default Project\al-firdous-portal"
npm install
node scripts/migrate.js          # ينسخ seed.json إلى MongoDB المحلي
npm start                        # http://localhost:3000
```

افتح: `http://localhost:3000/#/women`

- الصفحة تقرأ من `http://localhost:3000/api` تلقائيًا (لأنها localhost).
- جرّب تعديل سجل من المتصفح، وافتح الصفحة في متصفح آخر — ستتحدث خلال 10 ثوانٍ.

---

## 2) قاعدة البيانات على MongoDB Atlas (تمت بالفعل ✅)

استخدمنا العنقود المجاني الجاهز بدل إنشاء واحد جديد (الحساب المجاني يسمح بعنقود M0 واحد فقط لكل مشروع):

| البند | القيمة |
|---|---|
| المشروع (Project) | `Project 0` |
| العنقود (Cluster) | **AliAhmed** — M0 Free — AWS Singapore (`ap-southeast-1`) |
| قاعدة البيانات (Database) | `al_firdous` |
| المستخدم | `alfirdous` — صلاحية `Read and write to any database` |
| الشبكة | `0.0.0.0/0` (Allow Access from Anywhere) + IP المالك |

> ⚠️ العنقود يحتوي بالفعل على بيانات مشروع آخر (`sample_mflix` وغيرها) — **لا تحذف أي شيء**،
> الموقع يستخدم قاعدة `al_firdous` فقط.

### رابط الاتصال (`MONGODB_URI`)

```
mongodb+srv://alfirdous:PASSWORD@aliahmed.1hjnoaw.mongodb.net/al_firdous?retryWrites=true&w=majority
```

كلمة المرور تحتوي على الرمز `@`، ولذلك **يجب ترميزه** إلى `%40` داخل الرابط، وإلا سيُقرأ الرابط بشكل خطأ.

> 🔐 كلمة المرور الحقيقية محفوظة في ملف `.env` على جهاز المالك فقط (مستبعد من git) وفي إعدادات Vercel،
> ولا تُكتب أبدًا في هذا الملف لأن المستودع عام.

قاعدة الترميز للحروف الخاصة في كلمة المرور: `@` → `%40`، `:` → `%3A`، `/` → `%2F`، `?` → `%3F`، `#` → `%23`، `%` → `%25`.

---

## 3) نشر الـ API على Vercel (مجاني)

1. افتح <https://vercel.com/signup> وسجّل بحساب GitHub نفسه.
2. **Add New → Project** → اختر مستودع `al-firdous-portal` → **Import**.
3. قبل الضغط على Deploy، افتح **Environment Variables** وأضف:

| Name | Value |
|---|---|
| `MONGODB_URI` | رابط Atlas (نفس قيمة `.env` عندك، مع `%40` بدل `@` في كلمة المرور) |
| `MONGODB_DB` | `al_firdous` |
| `API_SECRET` | نفس القيمة الموجودة في `.env` وفي `index.html` |

> ⚠️ **مهم**: ضع `MONGODB_URI` في Environment Variables فقط — لا تكتبه في أي ملف داخل المستودع.

4. اضغط **Deploy** وانتظر دقيقة.
5. جرّب الرابط (استبدل `USER` و`PROJECT`):

```
https://al-firdous-portal.vercel.app/api?secret=CHANGE_ME_123
```

لازم يرجع JSON فيه `"ok":true` و`"staff":[]` (فارغ في البداية).

> ملاحظة: Vercel سيستضيف الموقع أيضًا على نفس الرابط، ويفتح تلقائيًا على `/api`
> لأن النطاق ينتهي بـ `.vercel.app`.

---

## 4) رفع البيانات الحالية إلى Atlas (تمت بالفعل ✅)

```powershell
cd "C:\Users\Ali\Documents\Default Project\al-firdous-portal"
$env:MONGODB_URI = "mongodb+srv://alfirdous:PASSWORD_ENCODED@aliahmed.1hjnoaw.mongodb.net/al_firdous?retryWrites=true&w=majority"
$env:MONGODB_DB  = "al_firdous"
node scripts/migrate.js
```

النتيجة المسجلة:

```
✅ staff: 252 سجل
✅ expenses: 4 سجل
✅ kafala: 30 سجل
✅ fath: 18 سجل
rev = 1
```

تم التحقق بعد الترحيل: 252 موظفًا، 34 معلمة نساء، إجمالي رواتب معلمات النساء 25,275 ج.م.

---

## 5) ربط الصفحة بالـ API

### أ) تجربة سريعة بدون تعديل الملف
افتح الموقع مرة بهذا الشكل (يُحفظ الرابط في المتصفح):

```
https://alyahmeed.github.io/al-firdous-portal/?api=https://al-firdous-portal.vercel.app/api
```

### ب) الربط الدائم لكل الأجهزة (المطلوب)
في `index.html` ابحث عن:

```js
const API = { base: '', secret: 'CHANGE_ME_123', pollMs: 10000 };
```

وضَع رابط الـ API:

```js
const API = { base: 'https://al-firdous-portal.vercel.app/api', secret: 'CHANGE_ME_123', pollMs: 10000 };
```

ثم:

```powershell
git add index.html version.json
git commit -m "Connect portal to MongoDB API"
git push
```

خلال دقيقتين يظهر التحديث على GitHub Pages، وستجد الشريط العلوي يقول:
**«متصل بقاعدة بيانات MongoDB — التعديلات تظهر على كل الأجهزة خلال 10 ثوانٍ.»**

---

## كيف يعمل التحديث اللحظي؟

- الصفحة تسأل الـ API كل **10 ثوانٍ** (`pollMs`).
- السيرفر يرجع رقم إصدار (`rev`) يتغير مع كل تعديل، فالصفحة تعيد الرسم فقط عند وجود تغيير فعلي.
- أثناء كتابة تعديل أو إضافة، يتوقف السحب مؤقتًا لمنع تعارض البيانات.
- عند إخفاء التبويب يتوقف السحب، وعند الرجوع يسحب فورًا.
- إذا فشل الاتصال، تظل البيانات المعروضة من آخر نسخة محفوظة على الجهاز، وتظهر رسالة خطأ حمراء.

## ملاحظات مهمة

- **النسخ الاحتياطي**: من Atlas يمكنك أخذ Backup، أو تصدير JSON:

  ```powershell
  $env:MONGODB_URI = "..."
  node -e "const{readAll}=require('./server/lib');readAll().then(d=>require('fs').writeFileSync('backup.json',JSON.stringify(d,null,1)))"
  ```

- **تغيير الـ secret**: غيّره في `API_SECRET` على Vercel، ثم في `index.html` (`API.secret`)، وأعد النشر/push.
- **الحد المجاني**: Atlas M0 = 512MB (بياناتك أقل من 1MB)، وVercel Hobby = 100GB نقل شهريًا.
  السحب كل 10 ثوانٍ لعدة أجهزة استهلاكه صغير جدًا.
- **Google Sheets** بقيت كخطة بديلة تعمل تلقائيًا لو كان `API.base` فارغًا (تحديثها كل 60 ثانية بدل 10 لتوفير حصة Apps Script).
- لا ترفع `seed.json` إلى GitHub (مستبعد في `.gitignore` لأنه يحتوي أرقامًا قومية).

## استكشاف الأخطاء

| المشكلة | السبب / الحل |
|---|---|
| الشريط يقول «تعذّر الاتصال بقاعدة بيانات MongoDB (401)» | قيمة `API.secret` لا تساوي `API_SECRET` على Vercel |
| `(network)` أو `(timeout)` | تأكد أن `API.base` ينتهي بـ `/api` وأن Vercel يعمل |
| `(HTTP 500)` مع `MongoServerError` | رابط `MONGODB_URI` أو كلمة المرور خطأ، أو IP غير مسموح في Atlas |
| الصفحة تعرض بيانات قديمة | افتح «تحديث الآن» في الشريط العلوي، أو تأكد أن الجهاز ليس عليه نسخة قديمة من الموقع |
| `refusing to replace with an empty list` | حماية من مسح قاعدة البيانات بقائمة فارغة — أرسل بيانات فعلية |
