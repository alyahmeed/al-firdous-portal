/**
 * ============================================================================
 *  مؤسسة الفردوس الإسلامية — Backend بقاعدة بيانات Google Sheets
 *  Al-Firdous Portal — Google Apps Script Web App
 * ============================================================================
 *
 *  خطوات الإعداد (مرة واحدة فقط):
 *  --------------------------------------------------------------------------
 *  1) افتح https://sheets.new وأنشئ جدولاً جديداً وسمّه مثلاً "الفردوس - العاملين".
 *  2) من القائمة: Extensions (الإضافات) -> Apps Script.
 *  3) امسح الكود الموجود، والصق هذا الملف بالكامل، واحفظ (Ctrl+S).
 *  4) اضغط Deploy (نشر) -> New deployment (نشر جديد).
 *       - اختر النوع: Web app.
 *       - Description: أي وصف.
 *       - Execute as (تنفيذ بصفة): Me (أنا).
 *       - Who has access (من يمكنه الوصول): Anyone (أي شخص).
 *     ثم Deploy ووافق على الأذونات (Authorize access).
 *  5) انسخ الرابط (Web app URL) — سيكون بالشكل:
 *       https://script.google.com/macros/s/XXXXXXXX/exec
 *  6) الصقه في ملف index.html داخل:
 *       const REMOTE = { url: 'ضع الرابط هنا', secret: 'نفس القيمة السحرية' };
 *
 *  ملاحظة أمان:
 *  - غيّر SECRET أدناه لأي كلمة سر تعرفها، وضع نفس القيمة في REMOTE.secret
 *    داخل index.html. (حماية بسيطة تمنع أي شخص لا يعرف الكلمة من الكتابة.)
 *  - التعديل من داخل الموقع يظهر للجميع فوراً بعد المزامنة.
 * ============================================================================
 */

// اسم ورقة العمل داخل الجدول
var SHEET_NAME = 'staff';

// (اختياري) إذا استخدمت السكربت المستقل (Standalone) من script.google.com
// ضع هنا معرّف الجدول (الجزء الطويل في رابط الشيت بين /d/ و /edit).
// إذا أنشأت السكربت من داخل الجدول (Extensions > Apps Script) اتركه فارغاً.
var SHEET_ID = '';

// كلمة سر مشتركة (غيّرها، وضع نفس القيمة في index.html)
var SECRET = 'CHANGE_ME_123';

// أعمدة الجدول بالترتيب
var HEADERS = ['id', 'name', 'job', 'category', 'period', 'branch', 'salary', 'phone', 'nationalId'];

/**
 * HTTP GET — لقراءة كل البيانات (يدعم JSONP للقراءة عبر المتصفح).
 */
function doGet(e) {
  try {
    var secret = (e && e.parameter && e.parameter.secret) || '';
    if (SECRET && secret !== SECRET) return respond({ ok: false, error: 'unauthorized' }, e);
    var data = readAll();
    return respond({ ok: true, data: data, count: data.length }, e);
  } catch (err) {
    return respond({ ok: false, error: String(err) }, e);
  }
}

/**
 * HTTP POST — للكتابة (إضافة / تعديل / حذف / استبدال الكل).
 * body = { action, secret, record, id, data }
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (SECRET && body.secret !== SECRET) return jsonOut({ ok: false, error: 'unauthorized' });

    var action = body.action;
    if (action === 'add') addRow(body.record);
    else if (action === 'update') updateRow(body.record);
    else if (action === 'delete') deleteRow(body.id);
    else if (action === 'replace') replaceAll(body.data || []);
    else return jsonOut({ ok: false, error: 'unknown action: ' + action });

    return jsonOut({ ok: true, count: readAll().length });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/** يرجع الجدول: من SHEET_ID إن وُجد، وإلا الجدول المرتبط بالسكربت. */
function getSpreadsheet() {
  if (SHEET_ID && SHEET_ID.length > 10) return SpreadsheetApp.openById(SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** يفتح/ينشئ ورقة العمل ويضمن وجود صف العناوين. */
function sheet() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** قراءة كل السجلات ككائنات. */
function readAll() {
  var sh = sheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0].map(function (h) { return String(h); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i], obj = {};
    for (var j = 0; j < head.length; j++) obj[head[j]] = row[j];
    if (obj.name !== '' && obj.name != null) {
      obj.id = Number(obj.id) || 0;
      obj.salary = Number(obj.salary) || 0;
      out.push(obj);
    }
  }
  return out;
}

/** إيجاد رقم الصف حسب الـ id (1-based ليتوافق مع Sheets). */
function findRowIndexById(id) {
  var sh = sheet();
  var ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === Number(id)) return i + 2;
  }
  return -1;
}

/** توليد id جديد = أكبر id + 1. */
function nextId() {
  var all = readAll();
  var max = 0;
  for (var i = 0; i < all.length; i++) if (all[i].id > max) max = all[i].id;
  return max + 1;
}

function toRow(rec, id) {
  return [
    Number(id) || Number(rec.id) || 0,
    rec.name || '',
    rec.job || '',
    rec.category || '',
    rec.period || '',
    rec.branch || '',
    Number(rec.salary) || 0,
    rec.phone || '',
    rec.nationalId || ''
  ];
}

function addRow(rec) {
  if (!rec) return;
  sheet().appendRow(toRow(rec, nextId()));
}

function updateRow(rec) {
  if (!rec) return;
  var rowIndex = findRowIndexById(rec.id);
  if (rowIndex === -1) { addRow(rec); return; }
  sheet().getRange(rowIndex, 1, 1, HEADERS.length).setValues([toRow(rec)]);
}

function deleteRow(id) {
  var rowIndex = findRowIndexById(id);
  if (rowIndex !== -1) sheet().deleteRow(rowIndex);
}

function replaceAll(data) {
  var sh = sheet();
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).clearContent();
  }
  if (data.length === 0) return;
  var rows = data.map(function (r) { return toRow(r, r.id); });
  sh.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

/** إخراج JSON، ويدعم JSONP عند وجود callback. */
function respond(obj, e) {
  var cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOut(obj);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
