/**
 * Backend for the "מפת הידע לחירום 2.0" beta questionnaire.
 * Deploy this as a Web App bound to a Google Sheet — see README.md in this
 * folder for the one-time setup steps. Each POST from the React app becomes
 * one appended row, with columns auto-created from whatever keys are sent
 * (so the sheet's header row stays in sync with the form automatically).
 * If the submission includes a PDF (pdfBase64 + pdfFilename), it's also
 * saved as a file in a Drive folder — see PDF_FOLDER_NAME below — and the
 * row gets a link to it (pdfFile), or the reason it failed (pdfError).
 *
 * doGet is a verification endpoint for automated tests. It does nothing
 * unless the VERIFY_TOKEN script property is set, which only the TEST
 * deployment should have, and it only ever touches test rows
 * (LIVE-SMOKE-* / LOADTEST-*).
 */
var PDF_FOLDER_NAME = 'תשובות שאלון בטא - PDF';

// The only participant names doGet will read or delete.
var TEST_NAME_PATTERN = /^(LIVE-SMOKE|LOADTEST)-[A-Za-z0-9-]+$/;

function doPost(e) {
  var params = e.parameter;

  // The PDF fields are handled separately below — keep them out of the
  // spreadsheet row (a base64 PDF is far larger than a sheet cell allows).
  var sheetParams = {};
  for (var key in params) {
    if (key === 'pdfBase64' || key === 'pdfFilename') continue;
    sheetParams[key] = params[key];
  }
  sheetParams.pdfFile = '';
  sheetParams.pdfError = '';

  // Save the PDF first so its outcome can go into the same row. A failure is
  // recorded rather than thrown: the answers are saved either way.
  if (params.pdfBase64) {
    try {
      var folder = getOrCreateFolder_(PDF_FOLDER_NAME);
      var pdfBlob = Utilities.newBlob(
        Utilities.base64Decode(params.pdfBase64),
        'application/pdf',
        params.pdfFilename || 'שאלון-בטא.pdf',
      );
      sheetParams.pdfFile = folder.createFile(pdfBlob).getUrl();
    } catch (err) {
      sheetParams.pdfError = String(err);
    }
  }

  // Simultaneous submissions could otherwise overwrite each other's header changes.
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var headers = syncHeaders_(sheet, Object.keys(sheetParams));
    var row = headers.map(function (key) {
      return Object.prototype.hasOwnProperty.call(sheetParams, key) ? sheetParams[key] : '';
    });
    sheet.appendRow(row);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  return json_({ ok: true });
}

/** Make sure every key has a column (new ones go at the end); returns the header row. */
function syncHeaders_(sheet, keys) {
  var headers = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];
  var changed = false;
  keys.forEach(function (key) {
    if (headers.indexOf(key) === -1) {
      headers.push(key);
      changed = true;
    }
  });
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return headers;
}

/**
 * Test-only verification endpoint. GET <exec url>?token=...&action=...&prefix=...
 *   action=find     → every row whose participantName starts with prefix, with its PDF checked in Drive
 *   action=count    → just the numbers (for load tests with hundreds of rows)
 *   action=cleanup  → deletes those rows and moves their PDFs to the Drive trash
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var token = PropertiesService.getScriptProperties().getProperty('VERIFY_TOKEN');
  if (!token || p.token !== token) {
    return json_({ ok: false, error: 'verification disabled or wrong token' });
  }
  var prefix = p.prefix || '';
  if (!TEST_NAME_PATTERN.test(prefix)) {
    return json_({ ok: false, error: 'prefix must look like LIVE-SMOKE-<id> or LOADTEST-<id>' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (p.action === 'find') return json_(findRows_(prefix, true));
    if (p.action === 'count') return json_(findRows_(prefix, false));
    if (p.action === 'cleanup') return json_(cleanup_(prefix));
    return json_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}

function findRows_(prefix, withDetails) {
  var matches = matchingRows_(prefix);
  var result = {
    ok: true,
    rows: matches.rows.length,
    rowsWithPdfLink: 0,
    pdfErrors: 0,
    driveFiles: testFilesInDrive_(prefix).length,
  };
  var details = [];
  matches.rows.forEach(function (r) {
    if (r.values.pdfFile) result.rowsWithPdfLink++;
    if (r.values.pdfError) result.pdfErrors++;
    if (withDetails) details.push({ values: r.values, pdf: describePdf_(r.values.pdfFile) });
  });
  if (withDetails) result.matches = details;
  return result;
}

function describePdf_(url) {
  var id = fileIdFromUrl_(url);
  if (!id) return { found: false };
  try {
    var file = DriveApp.getFileById(id);
    var bytes = file.getBlob().getBytes().slice(0, 5);
    var header = String.fromCharCode.apply(null, bytes.map(function (b) { return b & 0xff; }));
    return {
      found: !file.isTrashed(),
      name: file.getName(),
      size: file.getSize(),
      mimeType: file.getMimeType(),
      startsWithPdfHeader: header === '%PDF-',
      folder: file.getParents().hasNext() ? file.getParents().next().getName() : '',
    };
  } catch (err) {
    return { found: false, error: String(err) };
  }
}

function cleanup_(prefix) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var matches = matchingRows_(prefix);
  var trashed = 0;
  if (matches.rows.length > 0) {
    // One rewrite instead of a deleteRow per row: a load test leaves hundreds,
    // and deleting them one by one can hit Apps Script's time limit.
    var remove = {};
    matches.rows.forEach(function (r) { remove[r.rowNumber] = true; });
    var data = sheet.getDataRange().getValues();
    var kept = data.filter(function (_, i) { return !remove[i + 1]; });
    sheet.getDataRange().clearContent();
    sheet.getRange(1, 1, kept.length, kept[0].length).setValues(kept);
  }
  // Every Drive file for this run, including any whose row never got written.
  testFilesInDrive_(prefix).forEach(function (file) {
    file.setTrashed(true);
    trashed++;
  });
  return { ok: true, deletedRows: matches.rows.length, trashedPdfs: trashed };
}

function matchingRows_(prefix) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastRow() < 2) return { rows: [] };
  var data = sheet.getDataRange().getDisplayValues();
  var headers = data[0];
  var nameCol = headers.indexOf('participantName');
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (nameCol >= 0 && String(data[i][nameCol]).indexOf(prefix) === 0) {
      var values = {};
      headers.forEach(function (h, j) { values[h] = data[i][j]; });
      rows.push({ rowNumber: i + 1, values: values });
    }
  }
  return { rows: rows };
}

function testFilesInDrive_(prefix) {
  var files = [];
  var folders = DriveApp.getFoldersByName(PDF_FOLDER_NAME);
  if (!folders.hasNext()) return files;
  // prefix is validated by TEST_NAME_PATTERN, so it's safe inside the query.
  var it = folders.next().searchFiles("title contains '" + prefix + "' and trashed = false");
  while (it.hasNext()) files.push(it.next());
  return files;
}

function fileIdFromUrl_(url) {
  var m = /\/d\/([^/]+)/.exec(url || '');
  return m ? m[1] : '';
}

function getOrCreateFolder_(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(name);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
