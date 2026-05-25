/**
 * AtomicFlow Google Apps Script Database Sync Wrapper
 * 
 * Paste this script into your Google Sheets Apps Script Editor:
 * 1. Open your Google Sheet.
 * 2. Click Extensions -> Apps Script.
 * 3. Delete any default template code and paste this entire file in.
 * 4. Click Save (Disk icon).
 * 5. Click Deploy -> New Deployment.
 * 6. Select Type: Web App.
 * 7. Set "Execute as": Me (your-email@gmail.com).
 * 8. Set "Who has access": Anyone (this allows your browser app and Netlify/Render server to access the sheet).
 * 9. Click Deploy, Authorize access, and copy the Web App URL!
 */

function doGet(e) {
  var action = e.parameter.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Set JSON response headers
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  if (action === 'test') {
    output.setContent(JSON.stringify({ status: 'ok', message: 'AtomicFlow Apps Script Connected Successfully!' }));
    return output;
  }
  
  if (action === 'pull') {
    var rawData = sheet.getRange(1, 1).getValue();
    var data = {};
    try {
      if (rawData) {
        data = JSON.parse(rawData);
      } else {
        throw new Error("Empty cell");
      }
    } catch(err) {
      // Return default database schema if empty/corrupted
      data = {
        habits: [],
        logs: {},
        blueprints: { identities: [], stacks: [] },
        tasks: []
      };
    }
    output.setContent(JSON.stringify(data));
    return output;
  }
  
  output.setContent(JSON.stringify({ error: 'Invalid action parameter. Must be "test" or "pull".' }));
  return output;
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    var postData = JSON.parse(e.postData.contents);
    
    if (postData.action === 'push') {
      var dataToSave = {
        habits: postData.habits || [],
        logs: postData.logs || {},
        blueprints: postData.blueprints || { identities: [], stacks: [] },
        tasks: postData.tasks || [],
        updatedAt: Date.now()
      };
      
      // Save entire JSON string into cell A1 for maximum speed and simplicity
      sheet.getRange(1, 1).setValue(JSON.stringify(dataToSave));
      
      output.setContent(JSON.stringify({ status: 'success', timestamp: Date.now() }));
      return output;
    }
    
    output.setContent(JSON.stringify({ error: 'Invalid or missing action in POST payload.' }));
    return output;
  } catch (err) {
    output.setContent(JSON.stringify({ error: 'Server error processing payload: ' + err.toString() }));
    return output;
  }
}
