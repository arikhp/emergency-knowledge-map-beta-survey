/**
 * Backend for the "מפת הידע לחירום 2.0" beta questionnaire.
 * Deploy this as a Web App bound to a Google Sheet — see README.md in this
 * folder for the one-time setup steps. Each POST from the React app becomes
 * one appended row, with columns auto-created from whatever keys are sent
 * (so the sheet's header row stays in sync with the form automatically).
 * If the submission includes a PDF (pdfBase64 + pdfFilename), it's also
 * saved as a file in a Drive folder — see PDF_FOLDER_NAME below.
 */
var PDF_FOLDER_NAME = 'תשובות שאלון בטא - PDF';

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var params = e.parameter;

  var pdfBase64 = params.pdfBase64;
  var pdfFilename = params.pdfFilename;

  // The PDF fields are handled separately below — keep them out of the
  // spreadsheet row (a base64 PDF is far larger than a sheet cell allows).
  var sheetParams = {};
  for (var key in params) {
    if (key === 'pdfBase64' || key === 'pdfFilename') continue;
    sheetParams[key] = params[key];
  }

  var headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1));
  var headers = sheet.getLastColumn() > 0 ? headerRange.getValues()[0] : [];

  // Make sure every incoming key has a column; append new ones to the end.
  var incomingKeys = Object.keys(sheetParams);
  incomingKeys.forEach(function (key) {
    if (headers.indexOf(key) === -1) {
      headers.push(key);
    }
  });

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  var row = headers.map(function (key) {
    return Object.prototype.hasOwnProperty.call(sheetParams, key) ? sheetParams[key] : '';
  });
  sheet.appendRow(row);

  if (pdfBase64) {
    try {
      var folder = getOrCreateFolder_(PDF_FOLDER_NAME);
      var pdfBlob = Utilities.newBlob(
        Utilities.base64Decode(pdfBase64),
        'application/pdf',
        pdfFilename || 'שאלון-בטא.pdf',
      );
      folder.createFile(pdfBlob);
    } catch (err) {
      // Row is already saved either way — a PDF-save hiccup shouldn't lose the response.
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify({ ok: true }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder_(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(name);
}
