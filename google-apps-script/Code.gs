/**
 * Backend for the "מפת הידע לחירום 2.0" beta questionnaire.
 * Deploy this as a Web App bound to a Google Sheet — see README.md in this
 * folder for the one-time setup steps. Each POST from the React app becomes
 * one appended row, with columns auto-created from whatever keys are sent
 * (so the sheet's header row stays in sync with the form automatically).
 */
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var params = e.parameter;

  var headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1));
  var headers = sheet.getLastColumn() > 0 ? headerRange.getValues()[0] : [];

  // Make sure every incoming key has a column; append new ones to the end.
  var incomingKeys = Object.keys(params);
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
    return Object.prototype.hasOwnProperty.call(params, key) ? params[key] : '';
  });
  sheet.appendRow(row);

  return ContentService.createTextOutput(
    JSON.stringify({ ok: true }),
  ).setMimeType(ContentService.MimeType.JSON);
}
