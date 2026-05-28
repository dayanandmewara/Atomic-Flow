/**
 * AtomicFlow Google Apps Script Database Sync Wrapper - V5 Ultra-Robust Upgrade
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
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("Could not access active spreadsheet. Make sure this script is bound to your Google Sheet (Extensions -> Apps Script).");
    }
    
    // Incredibly robust sheet retrieval to prevent null errors
    var dbSheet = ss.getSheetByName("Database");
    if (!dbSheet) {
      var sheets = ss.getSheets();
      if (sheets.length > 0) {
        dbSheet = sheets[0];
      } else {
        dbSheet = ss.insertSheet("Database");
      }
    }
    
    if (action === 'test') {
      output.setContent(JSON.stringify({ status: 'ok', message: 'AtomicFlow Apps Script Connected Successfully!' }));
      return output;
    }
    
    if (action === 'pull') {
      var rawData = dbSheet.getRange(1, 1).getValue();
      var data = {};
      try {
        if (rawData) {
          data = JSON.parse(rawData);
        } else {
          throw new Error("Empty cell");
        }
      } catch(err) {
        // Return default database schema if empty/corrupted/not JSON
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
  } catch (globalErr) {
    output.setContent(JSON.stringify({ 
      error: 'Runtime Error in doGet: ' + globalErr.toString(),
      stack: globalErr.stack,
      status: 'error'
    }));
    return output;
  }
}

function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("Could not access active spreadsheet.");
    }
    
    var postData = JSON.parse(e.postData.contents);
    
    if (postData.action === 'push') {
      var dataToSave = {
        habits: postData.habits || [],
        logs: postData.logs || {},
        blueprints: postData.blueprints || { identities: [], stacks: [] },
        tasks: postData.tasks || [],
        updatedAt: Date.now()
      };
      
      // 1. Save entire JSON string into cell A1 of the "Database" sheet for fast app/Claude sync
      var dbSheet = ss.getSheetByName("Database");
      if (!dbSheet) {
        dbSheet = ss.insertSheet("Database");
      }
      dbSheet.getRange(1, 1).setValue(JSON.stringify(dataToSave));
      
      // 2. Write Habits Sheet in human-readable rows
      var habitsSheet = ss.getSheetByName("Habits");
      if (!habitsSheet) {
        habitsSheet = ss.insertSheet("Habits");
      }
      habitsSheet.clear();
      var habitsHeader = ["ID", "Name", "Category", "Time of Day", "Identity", "Cue", "Reward", "Two-Minute Version", "Stack Trigger", "Active", "Updated At"];
      habitsSheet.appendRow(habitsHeader);
      habitsSheet.getRange(1, 1, 1, habitsHeader.length).setFontWeight("bold").setBackground("#e8f0fe");
      
      var habits = dataToSave.habits;
      if (habits && habits.length > 0) {
        var habitsData = [];
        for (var i = 0; i < habits.length; i++) {
          var h = habits[i];
          habitsData.push([
            h.id || "",
            h.name || "",
            h.category || "",
            h.timeOfDay || "",
            h.identity || "",
            h.cue || "",
            h.reward || "",
            h.twoMinuteVersion || "",
            h.stackTrigger || "",
            h.active !== false ? "Yes" : "No",
            h.updatedAt ? new Date(h.updatedAt).toLocaleString() : ""
          ]);
        }
        habitsSheet.getRange(2, 1, habitsData.length, habitsHeader.length).setValues(habitsData);
      }
      
      // 3. Write Tasks Sheet in human-readable rows
      var tasksSheet = ss.getSheetByName("Tasks");
      if (!tasksSheet) {
        tasksSheet = ss.insertSheet("Tasks");
      }
      tasksSheet.clear();
      var tasksHeader = ["ID", "Text", "Completed", "Active", "Date", "Created At", "Updated At"];
      tasksSheet.appendRow(tasksHeader);
      tasksSheet.getRange(1, 1, 1, tasksHeader.length).setFontWeight("bold").setBackground("#e8f0fe");
      
      var tasks = dataToSave.tasks;
      if (tasks && tasks.length > 0) {
        var tasksData = [];
        for (var j = 0; j < tasks.length; j++) {
          var t = tasks[j];
          tasksData.push([
            t.id || "",
            t.text || "",
            t.completed ? "Yes" : "No",
            t.active !== false ? "Yes" : "No",
            t.date || "",
            t.createdAt ? new Date(t.createdAt).toLocaleString() : "",
            t.updatedAt ? new Date(t.updatedAt).toLocaleString() : ""
          ]);
        }
        tasksSheet.getRange(2, 1, tasksData.length, tasksHeader.length).setValues(tasksData);
      }
      
      // 4. Write Journal Logs Sheet in human-readable rows
      var journalSheet = ss.getSheetByName("Journal Logs");
      if (!journalSheet) {
        journalSheet = ss.insertSheet("Journal Logs");
      }
      journalSheet.clear();
      var journalHeader = ["Date", "Mood", "Energy", "Bedtime", "Wakeup", "Sleep Quality", "Wins", "1% Improvement Target", "Journal Notes", "Updated At"];
      journalSheet.appendRow(journalHeader);
      journalSheet.getRange(1, 1, 1, journalHeader.length).setFontWeight("bold").setBackground("#e8f0fe");
      
      var logs = dataToSave.logs;
      var logDates = Object.keys(logs).sort().reverse();
      if (logDates && logDates.length > 0) {
        var journalData = [];
        for (var k = 0; k < logDates.length; k++) {
          var date = logDates[k];
          var entry = logs[date];
          journalData.push([
            date,
            entry.mood || "",
            entry.energy || "",
            entry.sleepBedtime || "",
            entry.sleepWakeup || "",
            entry.sleepQuality || "",
            entry.wins ? entry.wins.join(", ") : "",
            entry.improvement || "",
            entry.journalNotes || "",
            entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : ""
          ]);
        }
        journalSheet.getRange(2, 1, journalData.length, journalHeader.length).setValues(journalData);
      }

      // Auto-resize columns for clean reading
      try {
        if (habits && habits.length > 0) habitsSheet.autoResizeColumns(1, habitsHeader.length);
        if (tasks && tasks.length > 0) tasksSheet.autoResizeColumns(1, tasksHeader.length);
        if (logDates && logDates.length > 0) journalSheet.autoResizeColumns(1, journalHeader.length);
      } catch (errResize) {
        // Ignore resize errors if any
      }
      
      output.setContent(JSON.stringify({ status: 'success', timestamp: Date.now() }));
      return output;
    }
    
    output.setContent(JSON.stringify({ error: 'Invalid or missing action in POST payload.' }));
    return output;
  } catch (err) {
    output.setContent(JSON.stringify({ 
      error: 'Runtime Error in doPost: ' + err.toString(),
      stack: err.stack,
      status: 'error'
    }));
    return output;
  }
}
