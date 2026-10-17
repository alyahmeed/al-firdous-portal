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
 *     (أو من https://script.google.com كسكربت مستقل + ضع معرّف الجدول في SHEET_ID)
 *  3) امسح الكود الموجود، والصق هذا الملف بالكامل، واحفظ (Ctrl+S).
 *  4) اضغط Deploy (نشر) -> New deployment (نشر جديد).
 *       - اختر النوع: Web app.
 *       - Execute as (تنفيذ بصفة): Me (أنا).
 *       - Who has access (من يمكنه الوصول): Anyone (أي شخص).
 *     ثم Deploy ووافق على الأذونات (Authorize access).
 *  5) انسخ الرابط (Web app URL) بالشكل:
 *       https://script.google.com/macros/s/XXXXXXXX/exec
 *  6) ضعه في ملف index.html داخل:
 *       const REMOTE = { url: 'ضع الرابط هنا', secret: 'نفس القيمة السحرية' };
 *
 *  أوراق العمل (تُنشأ تلقائياً):
 *    - staff    : بيانات العاملين
 *    - expenses : بنود المصروفات الشهرية
 *    - kafala   : سجلات كفالة اليتيم (كفالة أكتوبر 2026)
 *
 *  ملاحظة أمان: غيّر SECRET لأي كلمة سر، وضع نفس القيمة في REMOTE.secret.
 * ============================================================================
 */

// كلمة سر مشتركة (غيّرها، وضع نفس القيمة في index.html)
var SECRET = 'CHANGE_ME_123';

// (اختياري) معرّف الجدول عند استخدام السكربت المستقل من script.google.com
var SHEET_ID = '';

// تعريف الأوراق والأعمدة
var CONFIG = {
  staff: {
    sheetName: 'staff',
    headers: ['id', 'name', 'job', 'category', 'period', 'branch', 'salary', 'phone', 'nationalId'],
    textCols: [8, 9] // H (الهاتف) و I (الرقم القومي) كنص
  },
  expenses: {
    sheetName: 'expenses',
    headers: ['id', 'item', 'amount', 'notes'],
    textCols: []
  },
  kafala: {
    sheetName: 'kafala',
    headers: ['id', 'name', 'nationalId', 'phone', 'amount', 'spouse'],
    textCols: [3, 4] // C (الرقم القومي) و D (الموبايل) كنص
  }
};

/**
 * HTTP GET — قراءة البيانات (يدعم JSONP).
 *   بدون type  => كل الأوراق: { ok, staff:[...], expenses:[...], kafala:[...] }
 *   مع type     => { ok, data:[...] }
 */
function doGet(e) {
  try {
    var secret = (e && e.parameter && e.parameter.secret) || '';
    if (SECRET && secret !== SECRET) return respond({ ok: false, error: 'unauthorized' }, e);

    var type = e && e.parameter && e.parameter.type;
    if (type) return respond({ ok: true, data: readAll(type), count: readAll(type).length }, e);

    var out = { ok: true };
    for (var key in CONFIG) out[key] = readAll(key);
    return respond(out, e);
  } catch (err) {
    return respond({ ok: false, error: String(err) }, e);
  }
}

/**
 * HTTP POST — الكتابة (إضافة / تعديل / حذف / استبدال).
 * body = { action, type, secret, record, id, data }
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (SECRET && body.secret !== SECRET) return jsonOut({ ok: false, error: 'unauthorized' });

    var type = body.type || 'staff';
    if (!CONFIG[type]) return jsonOut({ ok: false, error: 'unknown type: ' + type });

    var action = body.action;
    if (action === 'add') addRow(type, body.record);
    else if (action === 'update') updateRow(type, body.record);
    else if (action === 'delete') deleteRow(type, body.id);
    else if (action === 'replace') replaceAll(type, body.data || []);
    else return jsonOut({ ok: false, error: 'unknown action: ' + action });

    return jsonOut({ ok: true, type: type, count: readAll(type).length });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/** يرجع الجدول: من SHEET_ID إن وُجد، وإلا الجدول المرتبط بالسكربت. */
function getSpreadsheet() {
  if (SHEET_ID && SHEET_ID.length > 10) return SpreadsheetApp.openById(SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function cfg(type) {
  var c = CONFIG[type];
  if (!c) throw new Error('unknown type: ' + type);
  return c;
}

/** يفتح/ينشئ ورقة العمل ويضمن العناوين وتنسيق النص. */
function sheet(type) {
  var c = cfg(type);
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(c.sheetName);
  if (!sh) sh = ss.insertSheet(c.sheetName);
  if (sh.getLastRow() === 0) {
    sh.appendRow(c.headers);
    sh.setFrozenRows(1);
  }
  for (var i = 0; i < c.textCols.length; i++) {
    sh.getRange(1, c.textCols[i], Math.max(sh.getMaxRows(), 2), 1).setNumberFormat('@');
  }
  return sh;
}

/** قراءة كل السجلات ككائنات. */
function readAll(type) {
  var c = cfg(type);
  var sh = sheet(type);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0].map(function (h) { return String(h); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i], obj = {};
    for (var j = 0; j < head.length; j++) obj[head[j]] = row[j];
    var keyVal = obj[c.headers[1]]; // أول عمود بيانات بعد id
    if (keyVal !== '' && keyVal != null) {
      obj.id = Number(obj.id) || 0;
      if ('salary' in obj) obj.salary = Number(obj.salary) || 0;
      if ('amount' in obj) obj.amount = Number(obj.amount) || 0;
      out.push(obj);
    }
  }
  return out;
}

function findRowIndexById(type, id) {
  var sh = sheet(type);
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === Number(id)) return i + 2;
  }
  return -1;
}

function nextId(type) {
  var all = readAll(type);
  var max = 0;
  for (var i = 0; i < all.length; i++) if (all[i].id > max) max = all[i].id;
  return max + 1;
}

function toRow(type, rec, id) {
  var c = cfg(type);
  var out = [];
  for (var i = 0; i < c.headers.length; i++) {
    var key = c.headers[i], val;
    if (key === 'id') val = Number(id) || Number(rec.id) || 0;
    else if (key === 'salary' || key === 'amount') val = Number(rec[key]) || 0;
    else val = rec[key] == null ? '' : String(rec[key]);
    out.push(val);
  }
  return out;
}

function setTextFormat(type, sh, startRow, numRows) {
  var c = cfg(type);
  if (!c.textCols.length || numRows <= 0) return;
  for (var i = 0; i < c.textCols.length; i++) {
    sh.getRange(startRow, c.textCols[i], numRows, 1).setNumberFormat('@');
  }
}

function addRow(type, rec) {
  if (!rec) return;
  var sh = sheet(type);
  var rowIndex = sh.getLastRow() + 1;
  setTextFormat(type, sh, rowIndex, 1);
  sh.getRange(rowIndex, 1, 1, cfg(type).headers.length).setValues([toRow(type, rec, nextId(type))]);
}

function updateRow(type, rec) {
  if (!rec) return;
  var rowIndex = findRowIndexById(type, rec.id);
  if (rowIndex === -1) { addRow(type, rec); return; }
  var sh = sheet(type);
  setTextFormat(type, sh, rowIndex, 1);
  sh.getRange(rowIndex, 1, 1, cfg(type).headers.length).setValues([toRow(type, rec)]);
}

function deleteRow(type, id) {
  var rowIndex = findRowIndexById(type, id);
  if (rowIndex !== -1) sheet(type).deleteRow(rowIndex);
}

function replaceAll(type, data) {
  var sh = sheet(type);
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, cfg(type).headers.length).clearContent();
  }
  if (data.length === 0) return;
  var rows = data.map(function (r) { return toRow(type, r, r.id); });
  setTextFormat(type, sh, 2, rows.length);
  sh.getRange(2, 1, rows.length, cfg(type).headers.length).setValues(rows);
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
