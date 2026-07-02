// Clipper Town — town leaderboard on Google Apps Script (NO new accounts:
// runs under the Google account you already have, free, no card).
//
// Same protocol as worker.js (one client speaks to either backend):
//   GET  <exec-url>?town=nbpt&course=southend   -> { rows: [{ n, t }, ...] }  (top 50, fastest first)
//   POST <exec-url>   body: { town, course, n, t }  as text/plain             -> { rows, place }
//   (text/plain keeps the browser from sending a CORS preflight, which Apps
//    Script web apps can't answer — the body is still plain JSON.)
//
// Storage: a Google Sheet this script creates in your Drive on first use
// ("Clipper Town Leaderboards"), one tab per town, one ROW per rider+course:
//   [course, name, time, updated]
// That sheet IS the moderation tool — open it, delete a row, the name is gone
// from the board on the next fetch. No database, no dashboard, no accounts.
//
// Names are re-validated SERVER-side with the same kid-safe filter as the
// client (never trust the client), times sanity-checked. Deploy steps: README.md.

var MAX_ROWS = 50;                          // rows returned per board
var KEY_RE = /^[a-z0-9-]{2,24}$/;           // town + course ids
var NAME_RE = /^[A-Z0-9 ]{1,12}$/;          // uppercase arcade names, as the client saves them

// same kid-safe filter as src/game/race.ts and worker.js — KEEP THE THREE IN SYNC
var LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '+': 't' };
var BAD_SUB = [
  'fuck', 'fuk', 'fck', 'fuq', 'phuck', 'shit', 'shyt', 'bitch', 'btch', 'cunt', 'cock', 'kock',
  'dick', 'penis', 'vagin', 'pussy', 'pusy', 'boob', 'tits', 'titty', 'porn', 'whore', 'slut',
  'anus', 'jizz', 'milf', 'dildo', 'rape', 'blowjob', 'handjob', 'boner',
  'nigg', 'nigr', 'fag', 'kike', 'wetback', 'retard', 'rtard', 'nazi', 'hitler', 'kkk', 'xxx',
  // compounds that dodge the whole-word tier (which exists so CASSIE/PASSED stay legal)
  'asshat', 'asshole', 'arsehole', 'arse', 'dumbass', 'jackass', 'butthole', 'buttcrack',
];
var BAD_WORD = ['ass', 'sex', 'cum', 'tit', 'hoe', 'anal', 'spic', 'meth'];
function nameIsClean(raw) {
  var s = raw.toLowerCase().replace(/[0134578@$!+]/g, function (c) { return LEET[c] || c; });
  s = s.replace(/[^a-z ]/g, '');
  var stripped = s.replace(/ /g, '');
  var collapsed = stripped.replace(/(.)\1+/g, '$1');
  for (var i = 0; i < BAD_SUB.length; i++) {
    if (stripped.indexOf(BAD_SUB[i]) >= 0 || collapsed.indexOf(BAD_SUB[i]) >= 0) return false;
  }
  for (var j = 0; j < BAD_WORD.length; j++) {
    if (new RegExp('\\b' + BAD_WORD[j] + '\\b').test(s)) return false;
  }
  return true;
}

// ---------- storage: one spreadsheet, one tab per town ----------

function getBook() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('bookId');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* deleted? make a new one */ }
  }
  var book = SpreadsheetApp.create('Clipper Town Leaderboards');
  props.setProperty('bookId', book.getId());
  return book;
}

function getTownSheet(book, town) {
  var sheet = book.getSheetByName(town);
  if (!sheet) {
    sheet = book.insertSheet(town);
    sheet.appendRow(['course', 'name', 'time', 'updated']);   // header = human-readable moderation view
  }
  return sheet;
}

/** all rows for a course, fastest first: [{ n, t }, ...] */
function readBoard(sheet, course) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var data = sheet.getRange(2, 1, last - 1, 3).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === course) rows.push({ n: String(data[i][1]), t: Number(data[i][2]) });
  }
  rows.sort(function (a, b) { return a.t - b.t; });
  if (rows.length > MAX_ROWS) rows.length = MAX_ROWS;
  return rows;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- the two endpoints ----------

function doGet(e) {
  var town = (e && e.parameter && e.parameter.town) || '';
  var course = (e && e.parameter && e.parameter.course) || '';
  if (!KEY_RE.test(town) || !KEY_RE.test(course)) return json({ error: 'bad ids' });
  var sheet = getTownSheet(getBook(), town);
  return json({ rows: readBoard(sheet, course) });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ error: 'bad json' }); }
  var town = body && body.town, course = body && body.course, n = body && body.n;
  if (!KEY_RE.test(town || '') || !KEY_RE.test(course || '')) return json({ error: 'bad ids' });
  if (typeof n !== 'string' || !NAME_RE.test(n) || !nameIsClean(n)) return json({ error: 'bad name' });
  var time = Number(body.t);
  if (!isFinite(time) || time < 5 || time > 7200) return json({ error: 'bad time' });

  // serialize concurrent posts — two kids finishing at once must not lose a row
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getTownSheet(getBook(), town);
    var last = sheet.getLastRow();
    var found = -1;
    if (last >= 2) {
      var data = sheet.getRange(2, 1, last - 1, 2).getValues();
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] === course && data[i][1] === n) { found = i + 2; break; }
      }
    }
    var t2 = Math.round(time * 100) / 100;
    if (found > 0) {
      if (t2 < Number(sheet.getRange(found, 3).getValue())) {
        sheet.getRange(found, 3, 1, 2).setValues([[t2, new Date().toISOString()]]);
      }
    } else {
      sheet.appendRow([course, n, t2, new Date().toISOString()]);
    }
    var rows = readBoard(sheet, course);
    var place = 1;
    for (var k = 0; k < rows.length; k++) { if (rows[k].n === n) { place = k + 1; break; } }
    return json({ rows: rows, place: place });
  } finally {
    lock.releaseLock();
  }
}
