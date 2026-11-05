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

## 2) إنشاء قاعدة البيانات على MongoDB Atlas (مجاني)

1. افتح <https://www.mongodb.com/cloud/atlas/register> وأنشئ حسابًا.
2. اختر **Create a deployment** → **M0 Free** → اختر أقرب منطقة (Frankfurt أو Ireland).
3. في **Security → Database Access** اضغط **Add New Database User**:
   - Username: `alfirdous`
   - Password: كلمة مرور قوية (احفظها)
   - Role: `Read and write to any database`
4. في **Security → Network Access** اضغط **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`).
   (ضروري لأن Vercel يتصل من عناوين متغيرة.)
5. من **Database → Connect → Drivers** انسخ رابط الاتصال، شكله:

```
mongodb+srv://alfirdous:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

استبدل `PASSWORD` بكلمة المرور الحقيقية. هذا هو `MONGODB_URI`.

---

## 3) نشر الـ API على Vercel (مجاني)

1. افتح <https://vercel.com/signup> وسجّل بحساب GitHub نفسه.
2. **Add New → Project** → اختر مستودع `al-firdous-portal` → **Import**.
3. قبل الضغط على Deploy، افتح **Environment Variables** وأضف:

| Name | Value |
|---|---|
| `MONGODB_URI` | رابط Atlas من الخطوة السابقة |
| `MONGODB_DB` | `al_firdous` |
| `API_SECRET` | `CHANGE_ME_123` (أو أي قيمة سرية جديدة) |

4. اضغط **Deploy** وانتظر دقيقة.
5. جرّب الرابط (استبدل `USER` و`PROJECT`):

```
https://al-firdous-portal.vercel.app/api?secret=CHANGE_ME_123
```

لازم يرجع JSON فيه `"ok":true` و`"staff":[]` (فارغ في البداية).

> ملاحظة: Vercel سيستضيف الموقع أيضًا على نفس الرابط، ويفتح تلقائيًا على `/api`
> لأن النطاق ينتهي بـ `.vercel.app`.

---

## 4) رفع البيانات الحالية إلى Atlas

من جهازك (مرة واحدة):

```powershell
cd "C:\Users\Ali\Documents\Default Project\al-firdous-portal"
$env:MONGODB_URI = "mongodb+srv://alfirdous:PASSWORD@cluster0.xxxxx.mongodb.net/"
node scripts/migrate.js
```

لازم تشوف:

```
✅ staff: 252 سجل
✅ expenses: 4 سجل
✅ kafala: 30 سجل
✅ fath: 18 سجل
```

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
- **Google Sheets** بقيت كخطة بديلة تعمل تلقائيًا لو كان `API.base` فارغًا.
- لا ترفع `seed.json` إلى GitHub (مستبعد في `.gitignore` لأنه يحتوي أرقامًا قومية).

## استكشاف الأخطاء

| المشكلة | السبب / الحل |
|---|---|
| الشريط يقول «تعذّر الاتصال بقاعدة بيانات MongoDB (401)» | قيمة `API.secret` لا تساوي `API_SECRET` على Vercel |
| `(network)` أو `(timeout)` | تأكد أن `API.base` ينتهي بـ `/api` وأن Vercel يعمل |
| `(HTTP 500)` مع `MongoServerError` | رابط `MONGODB_URI` أو كلمة المرور خطأ، أو IP غير مسموح في Atlas |
| الصفحة تعرض بيانات قديمة | افتح «تحديث الآن» في الشريط العلوي، أو تأكد أن الجهاز ليس عليه نسخة قديمة من الموقع |
| `refusing to replace with an empty list` | حماية من مسح قاعدة البيانات بقائمة فارغة — أرسل بيانات فعلية |
