'use strict';

/**
 * ============================================================================
 *  Migration — ينسخ نسخة البيانات الحالية (JSON) إلى MongoDB
 * ============================================================================
 *
 *  الاستخدام:
 *    node scripts/migrate.js                  # يقرأ seed.json من جذر المشروع
 *    node scripts/migrate.js path\to\data.json
 *    node scripts/migrate.js --dry            # يعرض فقط، بدون كتابة
 *
 *  ملف الـ JSON المتوقع:
 *    { "staff": [...], "expenses": [...], "kafala": [...], "fath": [...] }
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { TYPES, getDb, replaceAll, bumpRev, readAll, DB_NAME, URI } = require('../server/lib');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const fileArg = args.find((a) => !a.startsWith('--'));
const seedPath = fileArg ? path.resolve(fileArg) : path.join(__dirname, '..', 'seed.json');

async function main() {
  if (!fs.existsSync(seedPath)) {
    console.error('❌ ملف البيانات غير موجود: ' + seedPath);
    console.error('   ضع ملف JSON فيه staff / expenses / kafala / fath ثم أعد المحاولة.');
    process.exit(1);
  }

  const raw = fs.readFileSync(seedPath, 'utf8').replace(/^\uFEFF/, '');
  let seed;
  try {
    seed = JSON.parse(raw);
  } catch (err) {
    console.error('❌ الملف ليس JSON صالحاً: ' + err.message);
    process.exit(1);
  }

  console.log('📄 source : ' + seedPath);
  console.log('🗄️  target : ' + DB_NAME + '  (' + URI.replace(/\/\/[^@]*@/, '//***@') + ')');

  const summary = {};
  for (const type of TYPES) {
    summary[type] = Array.isArray(seed[type]) ? seed[type].length : 0;
  }
  console.log('📦 rows   : ' + JSON.stringify(summary));

  if (dry) {
    console.log('\nDRY RUN — لم تتم كتابة أي شيء.');
    return;
  }

  const db = await getDb();
  for (const type of TYPES) {
    const data = Array.isArray(seed[type]) ? seed[type] : [];
    if (data.length === 0) {
      console.log('   - ' + type + ': تم التخطي (لا توجد بيانات)');
      continue;
    }
    const res = await replaceAll(db, type, data);
    console.log('   ✅ ' + type + ': ' + res.count + ' سجل');
  }

  await bumpRev(db);

  const after = await readAll();
  console.log('\n🎉 تمت المزامنة. الأعداد الآن: ' +
    JSON.stringify({ staff: after.staff.length, expenses: after.expenses.length, kafala: after.kafala.length, fath: after.fath.length }));
  console.log('   rev = ' + after.rev);

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ فشل الترحيل: ' + (err && err.message ? err.message : err));
  process.exit(1);
});
