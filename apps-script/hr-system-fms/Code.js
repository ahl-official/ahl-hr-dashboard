  // ============================================
  // AHL HR MANAGEMENT SYSTEM — Code.gs
  // Sheet:https://docs.google.com/spreadsheets/d/1LVl3-5f8vLGt7YRTbmquUR09UFJgb9J0lTn7XSGc7OM
  // ============================================

  var SHEET_ID = '1LVl3-5f8vLGt7YRTbmquUR09UFJgb9J0lTn7XSGc7OM';

  var SHEETS = {
    CANDIDATE_APPS: 'Candidate Applications',
    CANDIDATE_FMS:  'Candidate FMS',
    EMPLOYEES:      'Employees',
    REQUISITIONS:   'Requisitions',
    INTERVIEW:      'Interview',
    ONBOARDING_PROGRESS: 'OnboardingProgress',
    LIFECYCLE_EVENTS: 'LifecycleEvents',
    FEEDBACK:       'Feedback',
    PROBLEMS:       'ProblemTracker',
    USERS:          'Users'
  };

  var PROBLEM_STAGES = [
    { id: 'p1', name: 'Report Logged' },
    { id: 'p2', name: 'Issue Analysis' },
    { id: 'p3', name: 'Resolution' },
    { id: 'p4', name: 'Closure' }
  ];

  var WAHA_CONFIG = {
    BASE_URL: 'https://waha.hairscalptradingco.com',
    SESSION:  'ahlaiteam',
    API_KEY:  'Americanhairline@123'
  };

  // ──────────────────────────────────────────
  //  SERVE
  // ──────────────────────────────────────────
  function doGet(e) {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('American Hairline — HR')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  function include(filename) {
      return HtmlService.createHtmlOutputFromFile(filename).getContent();
    }

  // ──────────────────────────────────────────
  //  AUTH
  // ──────────────────────────────────────────
  function authenticateUser(email, password, brand) {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(SHEETS.USERS);
      if (!sheet) return _demoAuth(email, password);
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (String(row[0]).trim().toLowerCase() === email.toLowerCase() && String(row[1]) === password) {
          return {
            success: true,
            user: {
              email:      String(row[0]),
              name:       String(row[2] || email.split('@')[0]),
              role:       String(row[3] || 'Employee'),
              brand:      String(row[4] || brand || 'ahl'),
              employeeId: String(row[5] || ''),
              mobile:     String(row[6] || '')
            }
          };
        }
      }
      return _demoAuth(email, password);
    } catch (e) {
      return _demoAuth(email, password);
    }
  }

  function _demoAuth(email, password) {
    var demos = {
      'admin@hr.com':   { password:'admin123',  name:'Admin HR',      role:'Admin',    brand:'ahl',      employeeId:'' },
      'hr@hr.com':      { password:'hr123',     name:'HR Manager',    role:'HR',       brand:'ahl',      employeeId:'' },
      'manager@hr.com': { password:'mgr123',    name:'Team Manager',  role:'Manager',  brand:'ahl',      employeeId:'' },
      'emp@hr.com':     { password:'emp123',    name:'John Employee', role:'Employee', brand:'ahl',      employeeId:'EMP-0001' },
      'alc@hr.com':     { password:'alc123',    name:'Alc Employee',  role:'Employee', brand:'alchamae', employeeId:'EMP-0002' }
    };
    var d = demos[email.toLowerCase()];
    if (d && d.password === password) {
      return { success: true, user: { email: email, name: d.name, role: d.role, brand: d.brand, employeeId: d.employeeId } };
    }
    return { success: false, message: 'Invalid credentials' };
  }

  // ──────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────
  function nowStr() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  function toTimestampDate(value) {
    if (!value) return '';
    var str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) return str;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str + ' 00:00:00';
    try {
      var d = new Date(str);
      if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, Session.getScriptTimeZone() || "GMT+5:30", 'yyyy-MM-dd HH:mm:ss');
      }
    } catch(e) {}
    return str;
  }

  function normalizePhone(p) {
    if (!p) return '';
    var clean = String(p).replace(/\D/g, '');
    if (clean.length >= 10) {
      return clean.slice(-10);
    }
    return clean;
  }

  function mergeStageData(existing, incoming) {
    if (!existing || typeof existing !== 'object') existing = {};
    if (!incoming || typeof incoming !== 'object') incoming = {};
    
    var result = {};
    for (var sid in existing) {
      if (existing.hasOwnProperty(sid)) {
        result[sid] = Object.assign({}, existing[sid]);
      }
    }
    
    for (var sid in incoming) {
      if (incoming.hasOwnProperty(sid)) {
        if (!result[sid]) {
          result[sid] = {};
        }
        var existingStage = result[sid];
        var incomingStage = incoming[sid] || {};
        
        for (var key in incomingStage) {
          if (incomingStage.hasOwnProperty(key)) {
            var incomingVal = incomingStage[key];
            
            if (key === 'checklist') {
              existingStage.checklist = Object.assign({}, existingStage.checklist || {}, incomingVal || {});
            } else if (incomingVal !== undefined && incomingVal !== null) {
              var isDateOrStatus = (key === 'actualDate' || key === 'plannedDate' || key === 'status');
              if (isDateOrStatus && incomingVal === '') {
                if (existingStage[key] === undefined || existingStage[key] === null) {
                  existingStage[key] = '';
                }
              } else {
                existingStage[key] = incomingVal;
              }
            }
          }
        }
      }
    }
    return result;
  }
  function todayStr() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  function genId(prefix, sheet) {
    var last = sheet.getLastRow();
    return prefix + String(last + 1).padStart(4, '0');
  }
  function safeStr(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return String(v);
  }

  function parseJsonSafe(value) {
    if (!value) return null;
    try { return JSON.parse(value); } catch (e) { return value; }
  }

  function normalizeKey(key) {
    return String(key || '').toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '').replace(/[’]/g, '').replace(/[-]/g, '');
  }

  var CAND_STAGE_ORDER = ['ar', 'ps', 'cc', 'jo', 'doc', 'ob'];

  function findDroppedCandidateStage(stageData) {
    if (!stageData || typeof stageData !== 'object') return null;
    for (var i = 0; i < CAND_STAGE_ORDER.length; i++) {
      var stageId = CAND_STAGE_ORDER[i];
      if (stageData[stageId] && String(stageData[stageId].status || '').trim() === 'Dropped') {
        return stageId;
      }
    }
    return null;
  }

  function clearFutureCandidateStages(stageData, droppedStageId) {
    if (!stageData || typeof stageData !== 'object') stageData = {};
    var droppedIdx = CAND_STAGE_ORDER.indexOf(droppedStageId);
    if (droppedIdx === -1) return stageData;

    for (var i = droppedIdx + 1; i < CAND_STAGE_ORDER.length; i++) {
      var stageId = CAND_STAGE_ORDER[i];
      if (!stageData[stageId]) stageData[stageId] = {};
      stageData[stageId].plannedDate = '';
      stageData[stageId].actualDate = '';
      stageData[stageId].interviewDate = '';
      stageData[stageId].status = '';
    }
    return stageData;
  }

  function normalizeStageDataForServer(stageData, existingStageData) {
    var data = typeof stageData === 'string' ? parseJsonSafe(stageData) : stageData;
    if (!data || typeof data !== 'object') return data;
    if (!existingStageData || typeof existingStageData !== 'object') existingStageData = {};
    var now = nowStr();
    for (var stageId in data) {
      if (!data.hasOwnProperty(stageId)) continue;
      if (data[stageId]) {
        if (data[stageId].plannedDate) data[stageId].plannedDate = toTimestampDate(data[stageId].plannedDate);
        if (data[stageId].actualDate) data[stageId].actualDate = toTimestampDate(data[stageId].actualDate);
      }
      if (data[stageId] && data[stageId].actualDate) {
        if (!existingStageData[stageId] || !existingStageData[stageId].actualDate) {
          data[stageId].actualDate = now;
          data[stageId].status = data[stageId].status || 'Completed';
        }
      }
    }
    return data;
  }

  function buildRequisitionRow(headers, data) {
    return headers.map(function(header) {
      var key = normalizeKey(header);
      switch (key) {
        case 'id':
        case 'reqid': return safeStr(data.id || '');
        case 'jobtitle': return safeStr(data.jobTitle || '');
        case 'department': return safeStr(data.department || '');
        case 'hiringmanager': return safeStr(data.hiringManager || '');
        case 'joblevel': return safeStr(data.jobLevel || '');
        case 'employmenttype': return safeStr(data.employmentType || '');
        case 'location': return safeStr(data.location || data.workLocation || '');
        case 'deadline': return safeStr(data.deadline || '');
        case 'reason': return safeStr(data.reason || data.reasonType || '');
        case 'status': return safeStr(data.status || 'Open');
        case 'createddate': return safeStr(data.createdDate || todayStr());
        case 'hireddate': return safeStr(data.hiredDate || '');
        case 'filledbycandidateid': return safeStr(data.filledByCandidateID || data.filledByCandidateId || '');
        case 'brand': return safeStr(data.brand || 'ahl');
        case 'minexp': return safeStr(data.minExp || '');
        case 'maxexp': return safeStr(data.maxExp || '');
        case 'openings': return safeStr(data.openings || '');
        case 'budget': return safeStr(data.budget || '');
        case 'worklocation': return safeStr(data.workLocation || '');
        case 'requiredskills': return safeStr(data.requiredSkills || '');
        case 'recruitername': return safeStr(data.recruiterName || '');
        case 'priority': return safeStr(data.priority || '');
        case 'targetstart': return safeStr(data.targetStart || '');
        case 'jobdescription': return safeStr(data.jobDescription || '');
        case 'notes': return safeStr(data.notes || '');
        default: return safeStr(data[key] || '');
      }
    });
  }

  function requisitionObjectFromRow(headers, row) {
    var obj = {};
    for (var i = 0; i < headers.length; i++) {
      var key = normalizeKey(headers[i]);
      var value = safeStr(row[i]);
      switch (key) {
        case 'jobtitle': obj.jobTitle = value; break;
        case 'hiringmanager': obj.hiringManager = value; break;
        case 'joblevel': obj.jobLevel = value; break;
        case 'employmenttype': obj.employmentType = value; break;
        case 'worklocation': obj.workLocation = value; break;
        case 'requiredskills': obj.requiredSkills = value; break;
        case 'recruitername': obj.recruiterName = value; break;
        case 'targetstart': obj.targetStart = value; break;
        case 'jobdescription': obj.jobDescription = value; break;
        case 'filledbycandidateid': obj.filledByCandidateID = value; break;
        default: obj[key] = value;
      }
    }
    return obj;
  }

  function getRequisitionHeaders() {
    return [
      'ID','Job Title','Department','Hiring Manager','Job Level',
      'Employment Type','Location','Deadline','Reason','Status',
      'Created Date','Hired Date','Filled By Candidate ID','Brand',
      'Min Exp','Max Exp','Openings','Budget','Work Location','Required Skills',
      'Recruiter Name','Priority','Target Start','Job Description','Notes'
    ];
  }

  function ensureRequisitionHeaders(sheet) {
    var reqHeaders = getRequisitionHeaders();
    var lastCol = Math.max(1, sheet.getLastColumn());
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    if (!currentHeaders.length || normalizeKey(currentHeaders[0]) !== 'id') {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(reqHeaders);
      } else {
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, reqHeaders.length).setValues([reqHeaders]);
      }
      styleHeader(sheet, reqHeaders.length);
      return reqHeaders;
    }
    if (currentHeaders.length < reqHeaders.length) {
      sheet.getRange(1, 1, 1, reqHeaders.length).setValues([reqHeaders]);
      styleHeader(sheet, reqHeaders.length);
      return reqHeaders;
    }
    return currentHeaders;
  }

  // ──────────────────────────────────────────
  //  SHEET INIT
  // ──────────────────────────────────────────
  function initSheets() {
    var ss = SpreadsheetApp.openById(SHEET_ID);

    var appSheet = ss.getSheetByName(SHEETS.CANDIDATE_APPS) || ss.insertSheet(SHEETS.CANDIDATE_APPS);
    var appHeaders = [
      'Timestamp', 'Full Name', 'WhatsApp', 'Email', 'Gender', 'City', 'Area', 'Date of Birth',
      'Source', 'Position Applied For', 'Experience', 'Education', 'Current Company', 'Current Designation',
      'Current Salary', 'Expected Salary', 'Notice Period', 'Availability', 'Skills', 'Languages',
      'LinkedIn URL', 'Portfolio URL', 'References', 'Why Join', 'Achievements', 'Certifications',
      'Additional Notes', 'Resume File', 'Resume Link', 'Status', 'Assigned To', 'Follow Up Date', 'Brand', 'ID'
    ];
    if (appSheet.getLastRow() === 0) {
      appSheet.appendRow(appHeaders);
      styleHeader(appSheet, appHeaders.length);
    } else {
      var currentAppHeaders = appSheet.getRange(1, 1, 1, appSheet.getLastColumn() || 1).getValues()[0];
      if (currentAppHeaders.length < appHeaders.length) {
        appSheet.getRange(1, 1, 1, appHeaders.length).setValues([appHeaders]);
        styleHeader(appSheet, appHeaders.length);
      }
    }

    var fmsSheet = ss.getSheetByName(SHEETS.CANDIDATE_FMS) || ss.insertSheet(SHEETS.CANDIDATE_FMS);
    var fmsHeaders = [
      'FMS ID', 'Candidate ID', 'Full Name', 'Phone', 'Current Stage', 'Status',
      'Interview Status', 'Archived', 'Archive Reason',
      'Stage Data (JSON)', 'Requisition ID', 'Updated At', 'Created At'
    ];
    
    // Aligned with frontend CAND_STAGES: ar, ps, cc, jo, doc, ob
    var stages = [
      { id: 'ar', name: 'Application Received' },
      { id: 'ps', name: 'Pre-Screening' },
      { id: 'cc', name: 'Confirmation Call' },
      { id: 'jo', name: 'Joining' },
      { id: 'doc', name: 'Documentation' },
      { id: 'ob', name: 'Onboarding' }
    ];
    stages.forEach(function(s) {
      fmsHeaders.push(s.name + ' Planned');
      fmsHeaders.push(s.name + ' Actual');
      fmsHeaders.push(s.name + ' Status');
      fmsHeaders.push(s.name + ' Delay');
    });

    // Dedicated columns for Personal and Bank details (User request: save in columns, not JSON)
    var personalHeaders = [
      'Date of Birth', 'Gender', 'Blood Group', 'Aadhar Card Number', 'PAN Number',
      'Permanent Address', 'Current Address', 'Personal E-mail ID',
      "Father's Name", "Mother's Name", 'Emergency Contact Name', 'Relationship', 'Emergency Contact Number',
      'Number of Siblings', 'Bank Name', 'Branch', 'Account Number', 'IFSC Code', 'Primary Hobbies', 'Dietary Preference', 'Vehicle Ownership', 'Housing Status'
    ];
    fmsHeaders = fmsHeaders.concat(personalHeaders);

    if (fmsSheet.getLastRow() === 0) {
      fmsSheet.appendRow(fmsHeaders);
      styleHeader(fmsSheet, fmsHeaders.length);
    } else {
      var currentHeaders = fmsSheet.getRange(1, 1, 1, fmsSheet.getLastColumn() || 1).getValues()[0];
      // Migration: Add Name and Phone if missing
      if (fmsSheet.getLastColumn() >= 2 && currentHeaders.indexOf('Full Name') === -1) {
        fmsSheet.insertColumnsAfter(2, 2);
      }
      // Update all headers to ensure full names and new structure
      fmsSheet.getRange(1, 1, 1, fmsHeaders.length).setValues([fmsHeaders]);
      styleHeader(fmsSheet, fmsHeaders.length);
    }

    var empSheet = ss.getSheetByName(SHEETS.EMPLOYEES) || ss.insertSheet(SHEETS.EMPLOYEES);
    var empHeaders = [
      'Timestamp', 'Full Name', 'Employee ID', 'Company', 'Current Designation', 'Department', 'Reporting Manager',
      'Date of Joining (DOJ)', 'Total Years of Experience', 'Company E-mail ID', 'Date of Birth', 'Gender', 'Blood Group',
      'Aadhar Card Number', 'PAN Number', 'Permanent Address', 'Current Address', 'Mobile Number', 'Personal E-mail ID',
      "Father's Name", "Mother's Name", 'Emergency Contact Name', 'Relationship', 'Emergency Contact Number',
      'Number of Siblings', 'Bank Name', 'Branch', 'Account Number', 'IFSC Code', 'Current Salary', 'Last Increment Year',
      'Increment Percentage', 'Short-term Goals', 'Core Strengths', 'Resource Requirements', 'Alignment with Company Vision',
      'Primary Hobbies', 'Company Assets', 'Dietary Preference', 'Political Background', 'Political Details',
      'Vehicle Ownership', 'Housing Status', 'Digital Signature', 'Date', 'PDF Link', 'Status', 'Brand'
    ];
    if (empSheet.getLastRow() === 0) {
      empSheet.appendRow(empHeaders);
      styleHeader(empSheet, empHeaders.length);
    } else {
      // Migration: update headers in existing sheet without deleting data
      var currentEmpHeaders = empSheet.getRange(1, 1, 1, empSheet.getLastColumn() || 1).getValues()[0];
      if (currentEmpHeaders.indexOf('Status') === -1 || currentEmpHeaders.length < empHeaders.length) {
        // Extend header row to match full schema
        empSheet.getRange(1, 1, 1, empHeaders.length).setValues([empHeaders]);
        styleHeader(empSheet, empHeaders.length);
      }
    }

    var reqSheet = ss.getSheetByName(SHEETS.REQUISITIONS) || ss.insertSheet(SHEETS.REQUISITIONS);
    var reqHeaders = [
      'ID','Job Title','Department','Hiring Manager','Job Level',
      'Employment Type','Location','Deadline','Reason','Status',
      'Created Date','Hired Date','Filled By Candidate ID','Brand',
      'Min Exp','Max Exp','Openings','Budget','Work Location','Required Skills',
      'Recruiter Name','Priority','Target Start','Job Description','Notes'
    ];
    if (reqSheet.getLastRow() === 0) {
      reqSheet.appendRow(reqHeaders);
      styleHeader(reqSheet, reqHeaders.length);
    } else {
      var currentReqHeaders = reqSheet.getRange(1, 1, 1, reqSheet.getLastColumn() || 1).getValues()[0];
      if (currentReqHeaders.length < reqHeaders.length) {
        reqSheet.getRange(1, 1, 1, reqHeaders.length).setValues([reqHeaders]);
        styleHeader(reqSheet, reqHeaders.length);
      }
    }

    var interviewSheet = ss.getSheetByName(SHEETS.INTERVIEW) || ss.insertSheet(SHEETS.INTERVIEW);
    var interviewHeaders = ['ID', 'Name', 'Email', 'WhatsApp', 'Questions', 'Correct Answers', 'Topics', 'Difficulty', 'Candidate Answers', 'Per Question Scores', 'Score', 'Tab Switches', 'Status', 'Timestamp', 'Position', 'Time Limit', 'Submitted At', 'Question Types'];
    if (interviewSheet.getLastRow() === 0) {
      interviewSheet.appendRow(interviewHeaders);
      styleHeader(interviewSheet, interviewHeaders.length);
    }

    var onbSheet = ss.getSheetByName(SHEETS.ONBOARDING_PROGRESS) || ss.insertSheet(SHEETS.ONBOARDING_PROGRESS);
    var onbHeaders = ['EmpId', 'PayloadJSON', 'UpdatedAt'];
    if (onbSheet.getLastRow() === 0) {
      onbSheet.appendRow(onbHeaders);
      styleHeader(onbSheet, onbHeaders.length);
    }

    var lcSheet = ss.getSheetByName(SHEETS.LIFECYCLE_EVENTS) || ss.insertSheet(SHEETS.LIFECYCLE_EVENTS);
    var lcHeaders = ['EmpId', 'PayloadJSON', 'UpdatedAt'];
    if (lcSheet.getLastRow() === 0) {
      lcSheet.appendRow(lcHeaders);
      styleHeader(lcSheet, lcHeaders.length);
    }

    var fbSheet = ss.getSheetByName(SHEETS.FEEDBACK) || ss.insertSheet(SHEETS.FEEDBACK);
    var fbHeaders = ['ID','Employee ID','Feedback Type','Rating','Feedback','Problems','Date','Author'];
    if (fbSheet.getLastRow() === 0) {
      fbSheet.appendRow(fbHeaders);
      styleHeader(fbSheet, fbHeaders.length);
    }

    var uSheet = ss.getSheetByName(SHEETS.USERS) || ss.insertSheet(SHEETS.USERS);
    if (uSheet.getLastRow() === 0) {
      uSheet.appendRow(['Email','Password','Name','Role','Brand','Employee ID','Mobile Number']);
      uSheet.appendRow(['admin@hr.com','admin123','Admin HR','Admin','ahl','','']);
      uSheet.appendRow(['hr@hr.com','hr123','HR Manager','HR','ahl','','']);
      uSheet.appendRow(['manager@hr.com','mgr123','Team Manager','Manager','ahl','','']);
      uSheet.appendRow(['emp@hr.com','emp123','John Employee','Employee','ahl','EMP-0001','']);
      uSheet.appendRow(['alc@hr.com','alc123','Alc Employee','Employee','alchamae','EMP-0002','']);
      styleHeader(uSheet, 7);
    }

    var probSheet = ss.getSheetByName(SHEETS.PROBLEMS) || ss.insertSheet(SHEETS.PROBLEMS);
    var probHeaders = [
      'ID', 'Date Logged', 'Problem Description', 'Raised By', 'Assigned To', 'Department',
      'Priority', 'Owner', 'Deadline', 'Status', 'Next Action', 'Category',
      'Author', 'Created At', 'Updated At', 'Stage Data (JSON)',
      'Report Logged Planned', 'Report Logged Actual', 'Report Logged Status', 'Report Logged Delay',
      'Issue Analysis Planned', 'Issue Analysis Actual', 'Issue Analysis Status', 'Issue Analysis Delay',
      'Resolution Planned', 'Resolution Actual', 'Resolution Status', 'Resolution Delay',
      'Closure Planned', 'Closure Actual', 'Closure Status', 'Closure Delay'
    ];
    if (probSheet.getLastRow() === 0) {
      probSheet.appendRow(probHeaders);
      styleHeader(probSheet, probHeaders.length);
    } else {
      var currentProbHeaders = probSheet.getRange(1, 1, 1, probSheet.getLastColumn() || 1).getValues()[0];
      if (currentProbHeaders.length < probHeaders.length) {
        probSheet.getRange(1, 1, 1, probHeaders.length).setValues([probHeaders]);
        styleHeader(probSheet, probHeaders.length);
      }
    }

    return { success: true, message: 'Sheets initialized' };
  }

  function styleHeader(sheet, numCols) {
    sheet.getRange(1, 1, 1, numCols)
      .setFontWeight('bold')
      .setBackground('#1A1917')
      .setFontColor('#FFFFFF')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    sheet.setFrozenRows(1);
  }

  // ──────────────────────────────────────────
  //  MIGRATE FMS SHEET (run once to add new columns)
  //  Call this from Apps Script editor manually once
  // ──────────────────────────────────────────
  function migrateFmsSheet() {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var fmsSheet = ss.getSheetByName(SHEETS.CANDIDATE_FMS);
      if (!fmsSheet) return { success: false, message: 'FMS sheet not found' };

      var headers = fmsSheet.getRange(1, 1, 1, fmsSheet.getLastColumn()).getValues()[0];

      // Check if new columns already exist
      if (headers.indexOf('Interview Status') === -1) {
        // Old format: ID | Candidate ID | Current Stage | Status | Stage Data | Req ID | Updated | Created
        // New format: ID | Candidate ID | Current Stage | Status | Interview Status | Archived | Archive Reason | Stage Data | Req ID | Updated | Created

        var lastRow = fmsSheet.getLastRow();

        // Get all existing data
        var data = lastRow > 1 ? fmsSheet.getRange(2, 1, lastRow - 1, 8).getValues() : [];

        // Clear old data
        if (lastRow > 1) fmsSheet.deleteRows(2, lastRow - 1);

        // Update header
        fmsSheet.getRange(1, 1, 1, 11).setValues([[
          'ID', 'Candidate ID', 'Current Stage', 'Status',
          'Interview Status', 'Archived', 'Archive Reason',
          'Stage Data (JSON)', 'Requisition ID', 'Updated At', 'Created At'
        ]]);
        styleHeader(fmsSheet, 11);

        // Re-insert data with new columns inserted
        if (data.length > 0) {
          var newData = data.map(function(row) {
            return [
              row[0], // ID
              row[1], // Candidate ID
              row[2], // Current Stage
              row[3], // Status
              'Active',  // Interview Status (new)
              'false',   // Archived (new)
              '',        // Archive Reason (new)
              row[4], // Stage Data
              row[5], // Req ID
              row[6], // Updated At
              row[7]  // Created At
            ];
          });
          fmsSheet.getRange(2, 1, newData.length, 11).setValues(newData);
        }

        return { success: true, message: 'FMS sheet migrated. ' + data.length + ' rows updated.' };
      }

      return { success: true, message: 'FMS sheet already in new format' };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  // ──────────────────────────────────────────
  //  CANDIDATES — READ
  // ──────────────────────────────────────────
  function getAllCandidates() {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var appSheet = ss.getSheetByName(SHEETS.CANDIDATE_APPS);
      var fmsSheet = ss.getSheetByName(SHEETS.CANDIDATE_FMS);
      if (!appSheet || !fmsSheet) return { success: true, data: [] };

      var appRows = appSheet.getDataRange().getValues();
      var fmsRows = fmsSheet.getDataRange().getValues();

      // Detect FMS format
      var fmsHeaderRow = fmsRows[0] || [];
      var hasDetails = fmsHeaderRow.indexOf('Full Name') !== -1;
      var hasIntStatus = fmsHeaderRow.indexOf('Interview Status') !== -1;

      var out = [];
      var seenIds = {};
      var seenEmails = {};
      var seenWhatsapps = {};

      // 1. Process FMS Entries (Primary Source)
      for (var i = 1; i < fmsRows.length; i++) {
        var r = fmsRows[i];
        var cid = safeStr(r[1]);
        if (!cid) continue;

        var obj = { id: cid };
        for (var j = 0; j < fmsHeaderRow.length; j++) {
          var key = fmsHeaderRow[j];
          var fk = key.toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '').replace(/[’]/g, '').replace(/[-]/g, '');
          var value = safeStr(r[j]);
          switch (fk) {
            case 'dateofbirth': obj.dob = value; obj.dateOfBirth = value; break;
            case 'currentcompany': obj.currentCompany = value; break;
            case 'currentdesignation': obj.currentDesignation = value; break;
            case 'currentsalary': obj.currentSalary = value; obj.currentCtc = value; break;
            case 'expectedsalary': obj.expectedSalary = value; obj.expectedCtc = value; break;
            case 'portfoliourl': obj.portfolioUrl = value; obj.portfolio = value; break;
            case 'portfolio': obj.portfolioUrl = value; obj.portfolio = value; break;
            case 'linkedinurl': obj.linkedinUrl = value; break;
            case 'resumelink': obj.resumeLink = value; break;
            case 'resumefile': obj.resumeFile = value; break;
            case 'additionalnotes': obj.additionalNotes = value; obj.notes = value; break;
            case 'whyjoin': obj.whyJoin = value; break;
            case 'achievements': obj.achievements = value; break;
            case 'followupdate': obj.followUpDate = value; break;
            case 'assignedto': obj.assignedTo = value; break;
            default: obj[fk] = value; break;
          }
        }
        
        // Standardize core keys for frontend compatibility
        obj.fmsId = obj.fmsid;
        obj.fullName = obj.fullname;
        obj.phone = obj.phone;
        obj.whatsapp = obj.whatsapp || obj.phone; // Fallback to phone
        obj.currentStage = obj.currentstage || 'Application Received';
        obj.status = obj.status || 'Active';
        obj.interviewStatus = obj.interviewstatus || 'Active';
        obj.archived = String(obj.archived) === 'true';
        obj.archiveReason = obj.archivereason;
        obj.stageData = obj.stagedatajson || '{}';
        obj.requisitionId = obj.requisitionid;
        obj.updatedAt = obj.updatedat;
        obj.createdAt = obj.createdat;
        obj.brand = obj.brand || 'ahl';

        var sdObj = {};
        if (obj.stageData) {
          var parsed = parseJsonSafe(obj.stageData);
          while (typeof parsed === 'string' && parsed !== '') {
            parsed = parseJsonSafe(parsed);
          }
          if (parsed && typeof parsed === 'object') {
            sdObj = parsed;
          }
        }
        obj.stageData = sdObj;

        out.push(obj);
        seenIds[cid] = obj;
        if (obj.email) seenEmails[obj.email.toLowerCase()] = obj;
        if (obj.whatsapp) {
          seenWhatsapps[String(obj.whatsapp).toLowerCase()] = obj;
          var normW = normalizePhone(obj.whatsapp);
          if (normW) seenWhatsapps[normW] = obj;
        }
        if (obj.phone) {
          seenWhatsapps[String(obj.phone).toLowerCase()] = obj;
          var normP = normalizePhone(obj.phone);
          if (normP) seenWhatsapps[normP] = obj;
        }
      }

      // 2. Process App Entries (Merge or add external forms)
      var appHeaderRow = appRows[0] || [];
      var normalizedAppHeaders = appHeaderRow.map(normalizeKey);
      var appIdIdx = normalizedAppHeaders.indexOf('id');
      var emailIdx = normalizedAppHeaders.indexOf('email');
      var whatsappIdx = normalizedAppHeaders.indexOf('whatsapp');
      var brandIdx = normalizedAppHeaders.indexOf('brand');
      var isNewAppFormat = normalizedAppHeaders[0] === 'timestamp' || normalizedAppHeaders[1] === 'fullname';

      for (var j = 1; j < appRows.length; j++) {
        var a = appRows[j];
        var aid = '';
        if (isNewAppFormat && appIdIdx !== -1) {
          aid = safeStr(a[appIdIdx]);
        } else if (isNewAppFormat) {
          aid = 'FORM-' + String(j).padStart(4, '0');
        } else {
          aid = safeStr(a[0]);
        }

        var cand = aid ? seenIds[aid] : null;
        var email = emailIdx !== -1 ? safeStr(a[emailIdx]) : '';
        var whatsapp = whatsappIdx !== -1 ? safeStr(a[whatsappIdx]) : '';
        var phone = whatsapp || (isNewAppFormat ? safeStr(a[2]) : safeStr(a[4]));

        var normWhatsapp = normalizePhone(whatsapp);
        var normPhone = normalizePhone(phone);

        if (!cand && email) {
          cand = seenEmails[email.toLowerCase()];
          if (cand) aid = cand.id;
        }
        if (!cand && whatsapp) {
          cand = seenWhatsapps[whatsapp.toLowerCase()] || seenWhatsapps[String(phone).toLowerCase()];
          if (!cand && normWhatsapp) cand = seenWhatsapps[normWhatsapp];
          if (!cand && normPhone) cand = seenWhatsapps[normPhone];
          if (cand) aid = cand.id;
        }
        if (!cand && phone) {
          cand = seenWhatsapps[String(phone).toLowerCase()];
          if (!cand && normPhone) cand = seenWhatsapps[normPhone];
          if (cand) aid = cand.id;
        }

        if (!cand) {
          // Not in FMS yet, add as new entry
          cand = {
            id: aid || ('FORM-' + String(j).padStart(4, '0')), currentStage: 'Application Received', status: 'Active',
            interviewStatus: 'Active', archived: false, stageData: {},
            createdAt: safeStr(a[0]), updatedAt: safeStr(a[0]), brand: 'ahl'
          };
          out.push(cand);
          if (aid) seenIds[aid] = cand;
          if (email) seenEmails[email.toLowerCase()] = cand;
          if (whatsapp) {
            seenWhatsapps[whatsapp.toLowerCase()] = cand;
            if (normWhatsapp) seenWhatsapps[normWhatsapp] = cand;
          }
          if (phone) {
            seenWhatsapps[String(phone).toLowerCase()] = cand;
            if (normPhone) seenWhatsapps[normPhone] = cand;
          }
        }

        // Fill in details from App Sheet
        if (isNewAppFormat) {
          // Career Form 32-col mapping
          cand.appliedDate = safeStr(a[0]);
          cand.fullName    = cand.fullName || safeStr(a[1]);
          cand.phone       = cand.phone || safeStr(a[2]);
          cand.whatsapp    = safeStr(a[2]);
          cand.email       = safeStr(a[3]);
          cand.gender      = safeStr(a[4]);
          cand.city        = safeStr(a[5]);
          cand.area        = safeStr(a[6]);
          cand.dob         = safeStr(a[7]);
          cand.source      = safeStr(a[8]);
          cand.position    = safeStr(a[9]);
          cand.experience  = safeStr(a[10]);
          cand.education   = safeStr(a[11]);
          cand.currentCompany = safeStr(a[12]);
          cand.currentDesignation = safeStr(a[13]);
          cand.currentSalary = safeStr(a[14]);
          cand.currentCtc = safeStr(a[14]);
          cand.expectedSalary = safeStr(a[15]);
          cand.expectedCtc = safeStr(a[15]);
          cand.noticePeriod = safeStr(a[16]);
          cand.skills = safeStr(a[18]);
          cand.cvLink = safeStr(a[28]);
          cand.resumeLink = safeStr(a[28]);
        } else {
          // HR Manual 16-col mapping
          cand.appliedDate = safeStr(a[1]);
          cand.fullName = cand.fullName || safeStr(a[2]);
          cand.email    = safeStr(a[3]);
          cand.phone    = cand.phone || safeStr(a[4]);
          cand.whatsapp = safeStr(a[4]);
          cand.position = safeStr(a[5]);
          cand.department = safeStr(a[6]);
          cand.experience = safeStr(a[7]);
          cand.skills     = safeStr(a[8]);
          cand.source     = safeStr(a[9]);
          cand.cvLink     = safeStr(a[10]);
          cand.resumeLink = safeStr(a[10]);
          cand.portfolio  = safeStr(a[11]);
          cand.expectedCtc = safeStr(a[12]);
          cand.expectedSalary = safeStr(a[12]);
          cand.currentCtc  = safeStr(a[13]);
          cand.currentSalary = safeStr(a[13]);
          cand.noticePeriod = safeStr(a[14]);
        }
        if (brandIdx !== -1) cand.brand = safeStr(a[brandIdx]) || 'ahl';
      }

      return { success: true, data: out };
    } catch (e) {
      Logger.log('getAllCandidates error: ' + e);
      return { success: false, message: e.toString(), data: [] };
    }
  }

  function getAllInterviewScores() {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(SHEETS.INTERVIEW);
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: {} };

      var rows = sheet.getDataRange().getValues();
      var headers = rows[0].map(function(h) { return normalizeKey(h); });
      var out = {};

      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (row.every(function(cell) { return cell === '' || cell === null || cell === undefined; })) continue;
        var record = {};
        for (var j = 0; j < headers.length; j++) {
          record[headers[j]] = safeStr(row[j]);
        }

        var key = record.id || record.candidateid || record.email || record.whatsapp;
        if (!key) continue;
        if (record.email) out[record.email.toLowerCase()] = record;
        if (record.whatsapp) out[record.whatsapp] = record;
        if (record.id) out[record.id] = record;
        if (record.candidateid) out[record.candidateid] = record;
      }

      return { success: true, data: out };
    } catch (e) {
      Logger.log('getAllInterviewScores error: ' + e);
      return { success: false, message: e.toString(), data: {} };
    }
  }

  // ──────────────────────────────────────────
  //  CANDIDATES — WRITE
  // ──────────────────────────────────────────
  function addCandidate(data) {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var appSheet = ss.getSheetByName(SHEETS.CANDIDATE_APPS);
      var fmsSheet = ss.getSheetByName(SHEETS.CANDIDATE_FMS);
      if (!appSheet || !fmsSheet || appSheet.getLastRow() === 0 || fmsSheet.getLastRow() === 0) {
        initSheets();
        appSheet = ss.getSheetByName(SHEETS.CANDIDATE_APPS);
        fmsSheet = ss.getSheetByName(SHEETS.CANDIDATE_FMS);
      }
      if (!appSheet || !fmsSheet) return { success: false, message: 'Sheets not found' };

      var id = genId('CAND-', appSheet || fmsSheet);
      var now = nowStr();

      // Also append to Candidate Applications so the frontend can merge form fields
      // and preserve candidate details for the right panel and search/filter views.
      var appLastCol = appSheet.getLastColumn();
      var appRow = appSheet.getRange(1, 1, 1, appLastCol).getValues()[0].map(function(header) {
        var h = String(header || '').trim();
        switch (h) {
          case 'Timestamp': return now;
          case 'Full Name': return data.fullName || '';
          case 'WhatsApp': return data.whatsapp || data.phone || '';
          case 'Email': return data.email || '';
          case 'Gender': return data.gender || '';
          case 'City': return data.city || '';
          case 'Area': return data.area || '';
          case 'Date of Birth': return data.dob || data.dateOfBirth || '';
          case 'Source': return data.appliedThrough || data.source || data.sourceChannel || '';
          case 'Position Applied For': return data.position || '';
          case 'Experience': return data.experience || '';
          case 'Education': return data.education || '';
          case 'Current Company': return data.currentCompany || '';
          case 'Current Designation': return data.currentDesignation || '';
          case 'Current Salary': return data.currentCtc || data.currentSalary || '';
          case 'Expected Salary': return data.expectedCtc || data.expectedSalary || '';
          case 'Notice Period': return data.noticePeriod || '';
          case 'Availability': return data.availability || '';
          case 'Skills': return data.skills || '';
          case 'Languages': return data.languages || '';
          case 'LinkedIn URL': return data.linkedinUrl || '';
          case 'Portfolio URL': return data.portfolioUrl || data.portfolio || '';
          case 'References': return data.references || '';
          case 'Why Join': return data.whyJoin || '';
          case 'Achievements': return data.achievements || '';
          case 'Certifications': return data.certifications || '';
          case 'Additional Notes': return data.notes || data.additionalNotes || '';
          case 'Resume File': return data.resumeFile || '';
          case 'Resume Link': return data.resumeLink || data.cvLink || '';
          case 'Status': return data.status || 'Active';
          case 'Assigned To': return data.assignedTo || '';
          case 'Follow Up Date': return data.followUpDate || '';
          case 'Brand': return data.brand || 'ahl';
          case 'ID': return id;
          default: return '';
        }
      });
      appSheet.appendRow(appRow);

      // Check FMS format
      var fLastCol = fmsSheet.getLastColumn();
      var fmsHeaders = fLastCol > 0 ? fmsSheet.getRange(1, 1, 1, fLastCol).getValues()[0] : [];
      
      // Safety: ensure migration has run
      if (fLastCol > 0 && fmsHeaders.indexOf('Full Name') === -1) {
        initSheets();
        fmsHeaders = fmsSheet.getRange(1, 1, 1, fmsSheet.getLastColumn()).getValues()[0];
      }
      
      var hasNewCols = fmsHeaders.indexOf('Interview Status') !== -1;

      var fmsId = 'FMS-' + Utilities.getUuid().substring(0, 8);
      // Candidate Details are now added to FMS
      if (hasNewCols) {
        fmsSheet.appendRow([
          fmsId, id, 
          data.fullName || '', 
          data.phone || '',
          data.currentStage || 'Application Received',
          data.status || 'Active',
          'Active',   // interviewStatus
          'false',    // archived
          '',         // archiveReason
          typeof data.stageData === 'string' ? data.stageData : JSON.stringify(data.stageData || {}),
          data.requisitionId || '', now, now
        ]);
      } else {
        fmsSheet.appendRow([
          fmsId, id, 
          data.fullName || '', 
          data.phone || '',
          data.currentStage || 'Application Received',
          data.status || 'Active',
          typeof data.stageData === 'string' ? data.stageData : JSON.stringify(data.stageData || {}),
          data.requisitionId || '', now, now
        ]);
      }

      // Send WhatsApp with form link to new candidate
      try {
        var phone = data.phone || '';
        if (phone) {
          var formMsg = "Hi " + (data.fullName || 'there') + "! 👋\n\n" +
            "Thank you for your interest in joining *American Hairline*.\n\n" +
            "Please fill out your candidate application form before your Pre-Screening begins:\n" +
            "🔗 https://candidate-application-form-seven.vercel.app/\n\n" +
            "This helps us understand your profile better. Please complete it at the earliest!\n\n" +
            "– AHL HR Team";
          sendWhatsAppMessage(phone, formMsg);
        }
      } catch (e) {
        Logger.log("Failed to send form link message: " + e);
      }

      return { success: true, id: id };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  function updateCandidate(id, updates) {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var fmsSheet = ss.getSheetByName(SHEETS.CANDIDATE_FMS);
      if (!fmsSheet) return { success: false, message: 'FMS sheet not found' };

      var now = nowStr();

      // Update/Upsert FMS Sheet only
      var lastCol = fmsSheet.getLastColumn();
      var fmsHeaders = lastCol > 0 ? fmsSheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      
      // Safety: ensure migration has run
      if (lastCol > 0 && fmsHeaders.indexOf('Full Name') === -1) {
        initSheets();
        lastCol = fmsSheet.getLastColumn();
        fmsHeaders = fmsSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      }
      
      var fmsRows = fmsSheet.getDataRange().getValues();
      var rowIndex = -1;
      var stageDataCol = -1;
      var fmsHeaderKeys = fmsHeaders.map(normalizeKey);
      for (var k = 0; k < fmsHeaderKeys.length; k++) {
        if (fmsHeaderKeys[k] === 'stagedata') {
          stageDataCol = k + 1;
          break;
        }
      }

      for (var j = 1; j < fmsRows.length; j++) {
        if (safeStr(fmsRows[j][1]) === String(id)) {
          rowIndex = j + 1;
          break;
        }
      }

      if (updates.stageData) {
        var existingStageData = {};
        if (rowIndex !== -1 && stageDataCol !== -1) {
          existingStageData = parseJsonSafe(fmsSheet.getRange(rowIndex, stageDataCol).getValue()) || {};
        }
        if (!existingStageData || typeof existingStageData !== 'object') {
          existingStageData = {};
        }
        var incomingStageData = typeof updates.stageData === 'string' ? parseJsonSafe(updates.stageData) : updates.stageData || {};
        incomingStageData = normalizeStageDataForServer(incomingStageData, existingStageData);
        var mergedStageData = mergeStageData(existingStageData, incomingStageData);
        updates.stageData = JSON.stringify(mergedStageData);
      }

      // If candidate not in FMS yet, append new row
      if (rowIndex === -1) {
        var newFmsId = 'FMS-' + Utilities.getUuid().substring(0, 8);
        var emptyRow = new Array(fmsHeaders.length).fill('');
        
        var appSheet = ss.getSheetByName(SHEETS.CANDIDATE_APPS);
        var appRows = appSheet ? appSheet.getDataRange().getValues() : [];
        var appHeaderRow = appRows[0] || [];
        var normalizedAppHeaders = appHeaderRow.map(normalizeKey);
        var appIdIdx = normalizedAppHeaders.indexOf('id');
        var appFullNameIdx = normalizedAppHeaders.indexOf('fullname');
        var appPhoneIdx = normalizedAppHeaders.indexOf('whatsapp');
        if (appPhoneIdx === -1) appPhoneIdx = normalizedAppHeaders.indexOf('phone');
        
        var appLookupRow = null;
        // 1. Try lookup by row number for synthetic FORM-NNNN IDs
        if (/^FORM-\d+$/.test(String(id))) {
          var formNum = parseInt(String(id).replace(/^FORM-/, ''), 10);
          if (!isNaN(formNum) && formNum >= 1 && formNum < appRows.length) {
            appLookupRow = appRows[formNum];
          }
        }
        // 2. Search by ID column or fallback to first column
        if (!appLookupRow) {
          for (var ar = 1; ar < appRows.length; ar++) {
            var rowId = (appIdIdx !== -1) ? safeStr(appRows[ar][appIdIdx]) : safeStr(appRows[ar][0]);
            if (rowId === String(id)) {
              appLookupRow = appRows[ar];
              break;
            }
          }
        }
        
        var fullNameVal = '';
        var phoneVal = '';
        if (appLookupRow) {
          var isNewAppFormat = normalizedAppHeaders[0] === 'timestamp' || normalizedAppHeaders[1] === 'fullname';
          if (isNewAppFormat) {
            fullNameVal = safeStr(appLookupRow[appFullNameIdx !== -1 ? appFullNameIdx : 1]);
            phoneVal = safeStr(appLookupRow[appPhoneIdx !== -1 ? appPhoneIdx : 2]);
          } else {
            fullNameVal = safeStr(appLookupRow[2]);
            phoneVal = safeStr(appLookupRow[4]);
          }
        }
        
        emptyRow[0] = newFmsId;
        emptyRow[1] = id;
        emptyRow[2] = updates.fullName || fullNameVal || '';
        emptyRow[3] = updates.phone || phoneVal || '';
        emptyRow[4] = updates.currentStage || 'Application Received';
        emptyRow[5] = updates.status || 'Active';
        emptyRow[6] = updates.interviewStatus || 'Active';
        emptyRow[7] = updates.archived !== undefined ? String(updates.archived) : 'false';
        emptyRow[8] = updates.archiveReason || '';
        emptyRow[9] = updates.stageData || '{}';
        emptyRow[10] = updates.requisitionId || '';
        emptyRow[11] = now; // Updated At
        emptyRow[12] = now; // Created At
        
        fmsSheet.appendRow(emptyRow);
        rowIndex = fmsSheet.getLastRow();
      }

      // Dynamic Column Mapping for FMS (User request: save in columns)
      for (var uKey in updates) {
        var targetCol = -1;
        var ukClean = uKey.toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '').replace(/[’]/g, '').replace(/[-]/g, '');
        for (var k = 0; k < fmsHeaders.length; k++) {
          var hkClean = fmsHeaders[k].toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '').replace(/[’]/g, '').replace(/[-]/g, '');
          if (hkClean === ukClean) {
            targetCol = k + 1;
            break;
          }
        }
        if (targetCol !== -1) {
          var uVal = updates[uKey];
          if (uKey === 'stageData' && typeof uVal === 'object') uVal = JSON.stringify(uVal);
          if (uKey === 'archived') uVal = String(uVal);
          fmsSheet.getRange(rowIndex, targetCol).setValue(uVal);
        }
      }
      
      // 3. Update Detailed Stage Columns if stageData is present
      if (updates.stageData) {
        var sd = typeof updates.stageData === 'string' ? JSON.parse(updates.stageData) : updates.stageData;

        var stageIndexMap = {
          'ar': 0,
          'ps': 1,
          'cc': 2,
          'jo': 3,
          'doc': 4,
          'ob': 5
        };

        for (var sId in sd) {
          var sData = sd[sId];
          var sIdx = stageIndexMap[sId];

          if (sIdx !== undefined && sData) {
            var baseCol = 14 + (sIdx * 4);

            // Planned Date — update only if provided
            if (sData.plannedDate !== undefined && sData.plannedDate !== '') {
              fmsSheet.getRange(rowIndex, baseCol).setValue(toTimestampDate(sData.plannedDate));
            }

            // Actual Date — update only if provided
            if (sData.actualDate !== undefined && sData.actualDate !== '') {
              fmsSheet.getRange(rowIndex, baseCol + 1).setValue(toTimestampDate(sData.actualDate));
            }

            // Status — update ONLY if status is explicitly provided
            if (sData.status !== undefined && sData.status !== '') {
              fmsSheet.getRange(rowIndex, baseCol + 2).setValue(sData.status);
            }

            // Delay — calculate only when both dates are available
            if (sData.plannedDate && sData.actualDate) {
              var pDate = new Date(sData.plannedDate);
              var aDate = new Date(sData.actualDate);
              var diff = Math.floor((aDate - pDate) / (1000 * 60 * 60 * 24));
              fmsSheet.getRange(rowIndex, baseCol + 3).setValue(diff);
            }
          }
        }
      }

      fmsSheet.getRange(rowIndex, 12).setValue(now); // Updated At
      return { success: true };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  // ──────────────────────────────────────────
  //  CANDIDATE INTERVIEW STATUS
  //  interviewStatus: Active | Passed | Hold | Rejected | Dropped | Failed | No Show | Cancelled
  //  Terminal statuses → archive candidate and mark current stage as closed
  // ──────────────────────────────────────────
  function updateCandidateInterviewStatus(id, interviewStatus, reason, date, evalData) {
    try {
      var updates = { interviewStatus: interviewStatus };

      var terminalStatuses = ['Rejected', 'Dropped', 'Failed', 'No Show', 'Cancelled'];
      var isTerminal = terminalStatuses.indexOf(interviewStatus) !== -1;

      var candidates = getAllCandidates();
      if (candidates.success) {
        var cand = candidates.data.find(function(c) { return String(c.id) === String(id); });
        if (cand && cand.currentStage) {
          var stageData = cand.stageData;
          if (typeof stageData === 'string') {
            stageData = parseJsonSafe(stageData);
            while (typeof stageData === 'string' && stageData !== '') {
              stageData = parseJsonSafe(stageData);
            }
          }
          if (!stageData || typeof stageData !== 'object') {
            stageData = {};
          }
          stageData = JSON.parse(JSON.stringify(stageData));
          var stageMap = {
            'Application Received': 'ar',
            'Pre-Screening': 'ps',
            'Confirmation Call': 'cc',
            'Joining': 'jo',
            'Documentation': 'doc',
            'Onboarding': 'ob'
          };
          var currentStage = cand.currentStage === 'Job Offer' ? 'Joining' : cand.currentStage;
          var stageId = stageMap[currentStage];
          if (stageId) {
            if (!stageData[stageId]) stageData[stageId] = {};
            
            if (isTerminal) {
              updates.archived = true;
              updates.archiveReason = reason || interviewStatus;
              updates.status = 'Archived';
              
              stageData[stageId].actualDate = nowStr();
              stageData[stageId].status = interviewStatus;
              stageData[stageId].closedReason = reason || interviewStatus;
              stageData.archiveMonth = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
            } else if (interviewStatus === 'Interview Scheduled') {
              if (date) {
                stageData[stageId].interviewDate = date;
                stageData[stageId].status = 'Interview Scheduled';
                var stages = ['ar', 'ps', 'cc', 'jo', 'doc', 'ob'];
                var curIdx = stages.indexOf(stageId);
                if (curIdx !== -1 && curIdx + 1 < stages.length) {
                  var nextStageId = stages[curIdx + 1];
                  if (!stageData[nextStageId]) stageData[nextStageId] = {};
                  stageData[nextStageId].plannedDate = toTimestampDate(date);
                  stageData[nextStageId].status = stageData[nextStageId].status || 'Pending';
                }
              }
            } else if (interviewStatus === 'Passed') {
              updates.archived = false;
              updates.status   = 'Active';
            } else {
              updates.archived = false;
              stageData[stageId].status = interviewStatus;
            }
            
            // Merge evaluation data if provided
            if (evalData) {
              if (typeof evalData === 'string') {
                evalData = parseJsonSafe(evalData);
              }
              if (evalData && typeof evalData === 'object') {
                for (var key in evalData) {
                  if (evalData.hasOwnProperty(key)) {
                    stageData[stageId][key] = evalData[key];
                  }
                }
                if (evalData.followUpDate) {
                  updates.followUpDate = toTimestampDate(evalData.followUpDate);
                }
              }
            }
            
            updates.stageData = stageData;
          }
        }
      }

      return updateCandidate(id, updates);
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  // Restore an archived candidate
  function restoreCandidate(id) {
    try {
      return updateCandidate(id, {
        interviewStatus: 'Active',
        archived:        false,
        archiveReason:   '',
        status:          'Active'
      });
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  // ──────────────────────────────────────────
  //  ONBOARD CANDIDATE
  // ──────────────────────────────────────────
  function onboardCandidate(candidateId) {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var candidates = getAllCandidates();
      if (!candidates.success) return candidates;

      var cand = candidates.data.find(function(c) { return String(c.id) === String(candidateId); });
      if (!cand) return { success: false, message: 'Candidate not found' };

      var empSheet = ss.getSheetByName(SHEETS.EMPLOYEES);
      var empId = genId('EMP-', empSheet);
      var today = todayStr();
      var now = nowStr();
      var empHeaders = empSheet.getRange(1, 1, 1, empSheet.getLastColumn()).getValues()[0];
      var empRow = new Array(empHeaders.length).fill('');
      
      // Auto-map candidate fields to employee columns (Dynamic mapping)
      for (var k = 0; k < empHeaders.length; k++) {
        var h = empHeaders[k];
        var hkClean = h.toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '').replace(/[’]/g, '').replace(/[-]/g, '');
        if (cand.hasOwnProperty(hkClean)) {
          empRow[k] = cand[hkClean];
        }
      }
      
      // Explicit overrides / Required fields
      empRow[0] = now; // Timestamp
      empRow[1] = cand.fullName;
      empRow[2] = empId;
      empRow[3] = cand.brand === 'alchamae' ? 'Alchamae' : 'American Hairline';
      empRow[4] = cand.position;
      empRow[5] = cand.department;
      empRow[7] = today; // DOJ
      // Columns might shift, but these are often at the end or specific spots
      // We rely on dynamic mapping above, but can force status/brand if they are new
      var statusIdx = empHeaders.indexOf('Status');
      if (statusIdx !== -1) empRow[statusIdx] = 'Active';
      var brandIdx = empHeaders.indexOf('Brand');
      if (brandIdx !== -1) empRow[brandIdx] = cand.brand || 'ahl';

      empSheet.appendRow(empRow);

      // Update FMS Stage Data for Onboarding
      var sd = cand.stageData || {};
      if (!sd.ob) sd.ob = {};
      sd.ob.actualDate = now;
      sd.ob.status = 'Completed';
      if (sd.ob.plannedDate) {
        var pDate = new Date(sd.ob.plannedDate);
        var aDate = new Date(now);
        var diff = Math.floor((aDate - pDate) / (1000 * 60 * 60 * 24));
        sd.ob.timeDelay = diff;
      }

      updateCandidate(candidateId, {
        currentStage:    'Onboarding',
        status:          'Onboarded',
        interviewStatus: 'Passed',
        stageData:       sd
      });

      if (cand.requisitionId) {
        var reqSheet = ss.getSheetByName(SHEETS.REQUISITIONS);
        var rrows = reqSheet.getDataRange().getValues();
        for (var j = 1; j < rrows.length; j++) {
          if (safeStr(rrows[j][0]) === cand.requisitionId) {
            reqSheet.getRange(j+1, 10).setValue('Filled');
            reqSheet.getRange(j+1, 12).setValue(today);
            reqSheet.getRange(j+1, 13).setValue(candidateId);
            break;
          }
        }
      }

      // Send automated welcome message
      var waStatus = { success: true };
      try {
        var phone = cand.phone || cand.whatsapp;
        if (phone) {
          var msg = "Welcome to American Hairline! 🎉\n\nHi " + cand.fullName + ", we are thrilled to have you join our " + (cand.department || 'team') + " as a " + (cand.position || 'team member') + ". Your onboarding has been initiated.\n\nSee you soon!";
          waStatus = sendWhatsAppMessage(phone, msg);
        }
      } catch (e) {
        Logger.log("Failed to send welcome message: " + e);
        waStatus = { success: false, message: e.toString() };
      }

      return { 
        success: true, 
        employeeId: empId, 
        whatsapp: waStatus 
      };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  // ──────────────────────────────────────────
  //  EMPLOYEES
  // ──────────────────────────────────────────
  function getAllEmployees() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.EMPLOYEES);
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

      var lastCol = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();

      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var emp = {};
        for (var j = 0; j < headers.length; j++) {
          var key = headers[j];
          var fk = key.toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '').replace(/[’]/g, '').replace(/[-]/g, '');
          emp[fk] = safeStr(r[j]);
        }
        // Standardize core keys for UI
        emp.id = emp.employeeid || emp.id;
        emp.fullName = emp.fullname;
        emp.email = emp.companyemailid || emp.personalemailid;
        emp.phone = emp.mobilenumber;
        emp.brand = emp.brand || 'ahl';
        emp.status = emp.status || 'Active';
        emp.position = emp.currentdesignation || '';
        emp.joinDate = emp.dateofjoiningdoj || '';
        emp.department = emp.department || '';
        emp.dob = emp.dateofbirth || '';
        emp.discProfile = String(emp.discprofile || emp['DISC Profile'] || '').trim();
        emp.discSentAt = String(emp.discsentat || emp['DISC Sent At'] || '').trim();
        emp.discSent = !!(emp.discSentAt || emp.discProfile);
        emp.exitChecklist = parseJsonSafe(emp.exitchecklist) || parseJsonSafe(emp.exitchecklistjson) || emp.exitChecklist || {};

        out.push(emp);
      }
      return { success: true, data: out };
    } catch (e) {
      return { success: false, message: e.toString(), data: [] };
    }
  }

  function updateEmployee(id, updates) {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(SHEETS.EMPLOYEES);
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) return { success: false, message: 'No data' };

      var lastCol = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      var rowIndex = -1;
      var idColIdx = headers.indexOf('Employee ID');
      if (idColIdx === -1) idColIdx = headers.indexOf('ID');

      for (var i = 0; i < rows.length; i++) {
        if (safeStr(rows[i][idColIdx]) === String(id)) {
          rowIndex = i + 2;
          break;
        }
      }

      if (rowIndex === -1) return { success: false, message: 'Employee not found' };

      for (var uKey in updates) {
        var targetCol = -1;
        var ukClean = uKey.toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '').replace(/[’]/g, '').replace(/[-]/g, '');
        for (var k = 0; k < headers.length; k++) {
          var hkClean = headers[k].toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '').replace(/[’]/g, '').replace(/[-]/g, '');
          if (hkClean === ukClean) {
            targetCol = k + 1;
            break;
          }
        }
        if (targetCol !== -1) {
          sheet.getRange(rowIndex, targetCol).setValue(updates[uKey]);
        }
      }
      return { success: true };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  // ──────────────────────────────────────────
  //  REQUISITIONS
  // ──────────────────────────────────────────
  function getAllRequisitions() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.REQUISITIONS);
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
      var lastCol = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i][0]) continue;
        out.push(requisitionObjectFromRow(headers, rows[i]));
      }
      return { success: true, data: out };
    } catch (e) {
      return { success: false, message: e.toString(), data: [] };
    }
  }

  function addRequisition(data) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.REQUISITIONS);
      if (!sheet) return { success: false, message: 'Requisitions sheet not found' };
      var headers = ensureRequisitionHeaders(sheet);
      var row = buildRequisitionRow(headers, data);
      sheet.appendRow(row);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  function updateRequisition(id, updates) {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(SHEETS.REQUISITIONS);
      if (!sheet) return { success: false, message: 'Requisitions sheet not found' };
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) return { success: false, message: 'No requisitions' };
      var headers = ensureRequisitionHeaders(sheet);
      var lastCol = headers.length;
      var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var idCol = -1;
      for (var k = 0; k < headers.length; k++) {
        if (normalizeKey(headers[k]) === 'id' || normalizeKey(headers[k]) === 'reqid') {
          idCol = k;
          break;
        }
      }
      if (idCol === -1) return { success: false, message: 'ID column not found' };
      var rowIndex = -1;
      for (var i = 0; i < rows.length; i++) {
        if (safeStr(rows[i][idCol]) === String(id)) { rowIndex = i + 2; break; }
      }
      if (rowIndex === -1) return { success: false, message: 'Requisition not found' };
      for (var uKey in updates) {
        var uNorm = normalizeKey(uKey);
        for (var j = 0; j < headers.length; j++) {
          if (normalizeKey(headers[j]) === uNorm) {
            sheet.getRange(rowIndex, j + 1).setValue(safeStr(updates[uKey]));
            break;
          }
        }
      }
      return { success: true };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  function getAllOnboardingProgress() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.ONBOARDING_PROGRESS);
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: {} };
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
      var out = {};
      for (var i = 0; i < rows.length; i++) {
        var empId = safeStr(rows[i][0]);
        if (!empId) continue;
        out[empId] = parseJsonSafe(safeStr(rows[i][1])) || {};
      }
      return { success: true, data: out };
    } catch (e) {
      return { success: false, message: e.toString(), data: {} };
    }
  }

  function saveOnboardingProgress(empId, payload) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.ONBOARDING_PROGRESS);
      if (!sheet) return { success: false, message: 'OnboardingProgress sheet not found' };
      var lastRow = sheet.getLastRow();
      var foundRow = -1;
      if (lastRow > 1) {
        var rows = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < rows.length; i++) {
          if (safeStr(rows[i][0]) === String(empId)) { foundRow = i + 2; break; }
        }
      }
      var json = JSON.stringify(payload || {});
      if (foundRow !== -1) {
        sheet.getRange(foundRow, 2).setValue(json);
        sheet.getRange(foundRow, 3).setValue(nowStr());
      } else {
        sheet.appendRow([empId, json, nowStr()]);
      }
      return { success: true };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  function getAllLifecycleEvents() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.LIFECYCLE_EVENTS);
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: {} };
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
      var out = {};
      for (var i = 0; i < rows.length; i++) {
        var empId = safeStr(rows[i][0]);
        if (!empId) continue;
        var payload = parseJsonSafe(safeStr(rows[i][1])) || {};
        if (!out[empId]) out[empId] = [];
        out[empId].push(payload);
      }
      return { success: true, data: out };
    } catch (e) {
      return { success: false, message: e.toString(), data: {} };
    }
  }

  function saveLifecycleEvent(empId, payload) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.LIFECYCLE_EVENTS);
      if (!sheet) return { success: false, message: 'LifecycleEvents sheet not found' };
      sheet.appendRow([empId, JSON.stringify(payload || {}), nowStr()]);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  // ──────────────────────────────────────────
  //  FEEDBACK
  // ──────────────────────────────────────────
  function getAllFeedback() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.FEEDBACK);
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r[0]) continue;
        out.push({
          id: safeStr(r[0]), employeeId: safeStr(r[1]),
          feedbackType: safeStr(r[2]), rating: parseInt(r[3]) || 3,
          feedback: safeStr(r[4]), problems: safeStr(r[5]),
          date: safeStr(r[6]), author: safeStr(r[7])
        });
      }
      return { success: true, data: out };
    } catch (e) {
      return { success: false, message: e.toString(), data: [] };
    }
  }

  function addFeedback(data) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.FEEDBACK);
      if (!sheet) return { success: false, message: 'Feedback sheet not found' };
      var id = genId('FB-', sheet);
      sheet.appendRow([
        id, data.employeeId || '', data.feedbackType || '',
        data.rating || 3, data.feedback || '', data.problems || '',
        data.date || todayStr(), data.author || 'HR'
      ]);
      return { success: true, id: id };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  // ──────────────────────────────────────────
  //  EXTENDED SHEETS INIT
  // ──────────────────────────────────────────
  function initNewSheets() {
    var ss = SpreadsheetApp.openById(SHEET_ID);

    var lSheet = ss.getSheetByName('Leaves') || ss.insertSheet('Leaves');
    if (lSheet.getLastRow() === 0) {
      lSheet.appendRow(['ID','Employee ID','Brand','Leave Type','Days','From Date','To Date','Reason','Status','Created Date','Approved By']);
      styleHeader(lSheet, 11);
    }

    var hSheet = ss.getSheetByName('Holidays') || ss.insertSheet('Holidays');
    if (hSheet.getLastRow() === 0) {
      hSheet.appendRow(['ID','Name','Date','Type','Applies To','Created Date']);
      styleHeader(hSheet, 6);
      var yr = new Date().getFullYear();
      [['Republic Day','01-26','National','both'],['Holi','03-14','Festival','both'],
      ['Independence Day','08-15','National','both'],['Gandhi Jayanti','10-02','National','both'],
      ['Diwali','10-20','Festival','both'],['Christmas','12-25','National','both']].forEach(function(h,i) {
        hSheet.appendRow(['HOL-'+(i+1), h[0], yr+'-'+h[1], h[2], h[3], safeStr(new Date())]);
      });
    }

    var tSheet = ss.getSheetByName('Trainings') || ss.insertSheet('Trainings');
    if (tSheet.getLastRow() === 0) {
      tSheet.appendRow(['ID','Brand','Title','Department','Trainer','Planned Start','Duration','Description','Current Stage','Status','Stage Data (JSON)','Created Date','Updated Date']);
      styleHeader(tSheet, 13);
    }

    // Leaves sheet already handled above, add Trainings brand column if missing
    var probSheet2 = ss.getSheetByName(SHEETS.PROBLEMS);
    if (!probSheet2) {
      probSheet2 = ss.insertSheet(SHEETS.PROBLEMS);
      probSheet2.appendRow([
        'ID', 'Date Logged', 'Problem Description', 'Raised By', 'Department',
        'Priority', 'Owner', 'Deadline', 'Status', 'Next Action',
        'Author', 'Created At', 'Updated At'
      ]);
      styleHeader(probSheet2, 13);
    }

    return { success: true, message: 'New sheets initialized' };
  }

  // ──────────────────────────────────────────
  //  LEAVES
  // ──────────────────────────────────────────
  function getAllLeaves() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Leaves');
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i]; if (!r[0]) continue;
        out.push({ id: safeStr(r[0]), employeeId: safeStr(r[1]), brand: safeStr(r[2]),
          leaveType: safeStr(r[3]), days: safeStr(r[4]), fromDate: safeStr(r[5]),
          toDate: safeStr(r[6]), reason: safeStr(r[7]),
          status: safeStr(r[8]) || 'Pending', createdDate: safeStr(r[9]) });
      }
      return { success: true, data: out };
    } catch (e) { return { success: false, message: e.toString(), data: [] }; }
  }

  function addLeave(data) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Leaves');
      if (!sheet) return { success: false, message: 'Leaves sheet not found' };
      var id = 'LV-' + String(sheet.getLastRow()).padStart(4, '0');
      sheet.appendRow([id, data.employeeId, data.brand||'ahl', data.leaveType,
        data.days, data.fromDate, data.toDate, data.reason,
        'Pending', data.createdDate||todayStr(), '']);
      return { success: true, id: id };
    } catch (e) { return { success: false, message: e.toString() }; }
  }

  function updateLeave(id, updates) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Leaves');
      if (!sheet) return { success: false, message: 'Sheet not found' };
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (safeStr(rows[i][0]) === String(id)) {
          if (updates.status) sheet.getRange(i+1, 9).setValue(updates.status);
          return { success: true };
        }
      }
      return { success: false, message: 'Leave not found' };
    } catch (e) { return { success: false, message: e.toString() }; }
  }

  // ──────────────────────────────────────────
  //  HOLIDAYS
  // ──────────────────────────────────────────
  function getAllHolidays() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Holidays');
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i]; if (!r[0]) continue;
        out.push({ id: safeStr(r[0]), name: safeStr(r[1]), date: safeStr(r[2]),
          type: safeStr(r[3]), appliesTo: safeStr(r[4]) || 'both' });
      }
      return { success: true, data: out };
    } catch (e) { return { success: false, message: e.toString(), data: [] }; }
  }

  function addHoliday(data) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Holidays');
      if (!sheet) return { success: false, message: 'Holidays sheet not found' };
      var id = 'HOL-' + String(sheet.getLastRow()).padStart(3, '0');
      sheet.appendRow([id, data.name, data.date, data.type, data.appliesTo||'both', data.createdDate||todayStr()]);
      return { success: true, id: id };
    } catch (e) { return { success: false, message: e.toString() }; }
  }

  function deleteHoliday(id) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Holidays');
      if (!sheet) return { success: false };
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (safeStr(rows[i][0]) === String(id)) { sheet.deleteRow(i+1); return { success: true }; }
      }
      return { success: false, message: 'Not found' };
    } catch (e) { return { success: false, message: e.toString() }; }
  }

  // ──────────────────────────────────────────
  //  TRAININGS
  // ──────────────────────────────────────────
  function getAllTrainings() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Trainings');
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).getValues();
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i]; if (!r[0]) continue;
        var sd = {}; try { sd = JSON.parse(safeStr(r[10]) || '{}'); } catch(e){}
        out.push({ id: safeStr(r[0]), brand: safeStr(r[1]), title: safeStr(r[2]),
          department: safeStr(r[3]), trainer: safeStr(r[4]), plannedStart: safeStr(r[5]),
          duration: safeStr(r[6]), description: safeStr(r[7]),
          currentStage: safeStr(r[8]) || 'Planning', status: safeStr(r[9]) || 'Active',
          stageData: sd, createdDate: safeStr(r[11]), updatedDate: safeStr(r[12]) });
      }
      return { success: true, data: out };
    } catch (e) { return { success: false, message: e.toString(), data: [] }; }
  }

  function addTraining(data) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Trainings');
      if (!sheet) return { success: false, message: 'Trainings sheet not found' };
      var id = 'TRN-' + String(sheet.getLastRow()).padStart(4, '0');
      var now = nowStr();
      sheet.appendRow([id, data.brand||'ahl', data.title, data.department||'All Staff',
        data.trainer||'', data.plannedStart||'', data.duration||1,
        data.description||'', data.currentStage||'Planning', data.status||'Active',
        data.stageData||'{}', data.createdDate||todayStr(), now]);
      return { success: true, id: id };
    } catch (e) { return { success: false, message: e.toString() }; }
  }

  function updateTraining(id, updates) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Trainings');
      if (!sheet) return { success: false, message: 'Sheet not found' };
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (safeStr(rows[i][0]) === String(id)) {
          var rowNum = i + 1;
          if (updates.stageData) {
            var existingStageData = parseJsonSafe(rows[i][10]) || {};
            updates.stageData = JSON.stringify(normalizeStageDataForServer(updates.stageData, existingStageData));
          }
          var fieldMap = { brand:2, title:3, department:4, trainer:5, plannedStart:6,
            duration:7, description:8, currentStage:9, status:10, stageData:11 };
          for (var key in updates) {
            if (fieldMap.hasOwnProperty(key)) sheet.getRange(rowNum, fieldMap[key]).setValue(updates[key]);
          }
          sheet.getRange(rowNum, 13).setValue(nowStr());
          return { success: true };
        }
      }
      return { success: false, message: 'Training not found: ' + id };
    } catch (e) { return { success: false, message: e.toString() }; }
  }

  // ──────────────────────────────────────────
  //  SEED DEMO DATA
  // ──────────────────────────────────────────
  function seedDemoCandidates() {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var appSheet = ss.getSheetByName(SHEETS.CANDIDATE_APPS);
      var fmsSheet = ss.getSheetByName(SHEETS.CANDIDATE_FMS);

      if (!appSheet || !fmsSheet) { initSheets(); appSheet = ss.getSheetByName(SHEETS.CANDIDATE_APPS); fmsSheet = ss.getSheetByName(SHEETS.CANDIDATE_FMS); }
      if (appSheet.getLastRow() > 1) appSheet.deleteRows(2, appSheet.getLastRow() - 1);
      if (fmsSheet.getLastRow() > 1) fmsSheet.deleteRows(2, fmsSheet.getLastRow() - 1);

      var appDemo = [
        ['CAND-0001','2026-04-10 10:00:00','Rahul Sharma','rahul.s@example.com','+91 98765 43210','Sales Manager','Sales','8','B2B Sales, CRM, Team Management','LinkedIn','https://drive.google.com','https://linkedin.com/in/rahulsharma','18L','15L','30 days'],
        ['CAND-0002','2026-04-12 11:30:00','Priya Patel','priya.p@example.com','+91 98765 43211','Senior Developer','IT','6','React, Node.js, AWS','Indeed','https://drive.google.com','https://github.com/priyapatel','28L','22L','60 days'],
        ['CAND-0003','2026-04-14 09:15:00','Amit Verma','amit.v@example.com','+91 98765 43212','AI Researcher','AI Team','4','Python, PyTorch, LLMs','Direct','https://drive.google.com','','35L','28L','90 days'],
        ['CAND-0004','2026-04-15 14:00:00','Sneha Reddy','sneha.r@example.com','+91 98765 43213','Automation Engineer','Automation Team','5','Selenium, Python, Jenkins','Referral','https://drive.google.com','https://sneha.dev','14L','11L','15 days'],
        ['CAND-0005','2026-04-16 16:45:00','Vikram Singh','vikram.s@example.com','+91 98765 43214','Marketing Executive','Marketing','3','SEO, SEM, Content Writing','Instagram','https://drive.google.com','','9L','7.5L','30 days'],
        ['CAND-0006','2026-04-17 10:20:00','Anjali Gupta','anjali.g@example.com','+91 98765 43215','HR Generalist','HR','7','Recruitment, Payroll','Indeed','https://drive.google.com','','15L','13L','Immediate'],
        ['CAND-0007','2026-04-18 12:00:00','Rohan Mehra','rohan.m@example.com','+91 98765 43216','Financial Analyst','Finance','4','Excel, Financial Modeling','LinkedIn','https://drive.google.com','','12L','10L','45 days'],
        ['CAND-0008','2026-04-19 15:30:00','Deepika Kaur','deepika.k@example.com','+91 98765 43217','Business Developer','Sales','2','Lead Gen, Cold Calling','Direct','https://drive.google.com','','10L','8L','30 days']
      ];

      var fmsDemo = [
        ['FMS-1','CAND-0001','Confirmation Call','Active','Active','false','','{}','REQ-001','2026-04-30','2026-04-10'],
        ['FMS-2','CAND-0002','Pre-Screening','Active','Hold','false','','{}','REQ-002','2026-04-30','2026-04-12'],
        ['FMS-3','CAND-0003','Pre-Screening','Active','Passed','false','','{}','REQ-003','2026-04-30','2026-04-14'],
        ['FMS-4','CAND-0004','Application Received','Active','Active','false','','{}','REQ-004','2026-04-30','2026-04-15'],
        ['FMS-5','CAND-0005','Application Received','Archived','Dropped','true','Not a cultural fit','{}','REQ-005','2026-04-30','2026-04-16'],
        ['FMS-6','CAND-0006','Application Received','Archived','Rejected','true','Skills mismatch','{}','REQ-006','2026-04-30','2026-04-17'],
        ['FMS-7','CAND-0007','Joining','Active','Passed','false','','{}','REQ-007','2026-04-30','2026-04-18'],
        ['FMS-8','CAND-0008','Onboarding','Active','Active','false','','{}','REQ-008','2026-04-30','2026-04-19']
      ];

      appSheet.getRange(2, 1, appDemo.length, appDemo[0].length).setValues(appDemo);
      fmsSheet.getRange(2, 1, fmsDemo.length, fmsDemo[0].length).setValues(fmsDemo);

      return { success: true, message: 'Demo data seeded' };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }

  // ──────────────────────────────────────────
  //  WHATSAPP (WAHA)
  // ──────────────────────────────────────────
  function sendWhatsAppMessage(phone, text) {
    try {
      // Sanitize phone number: keep only digits
      var cleanPhone = String(phone).replace(/\D/g, '');
      if (!cleanPhone) return { success: false, message: 'Invalid phone number' };
      
      // Ensure it has country code (default 91 if not specified and length is 10)
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
      
      var chatId = cleanPhone + '@c.us';
      var url = WAHA_CONFIG.BASE_URL + '/api/sendText';
      
      var payload = {
        chatId: chatId,
        text: text,
        session: WAHA_CONFIG.SESSION
      };
      
      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'X-Api-Key': WAHA_CONFIG.API_KEY
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();
      var body = response.getContentText();
      
      Logger.log("WAHA Response (" + code + "): " + body);
      
      if (code >= 200 && code < 300) {
        return { success: true, status: code, body: body };
      } else {
        return { success: false, status: code, message: "HTTP " + code + ": " + (body || "No response body") };
      }
    } catch (e) {
      Logger.log("sendWhatsAppMessage error: " + e);
      return { success: false, message: "Execution error: " + e.toString() };
    }
  }

  // ──────────────────────────────────────────
  //  PROBLEM TRACKER
  // ──────────────────────────────────────────
  function getAllProblems() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.PROBLEMS);
      if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
      var rows = sheet.getDataRange().getValues();
      var headers = rows[0].map(function(h) { return normalizeKey(h); });
      var out = [];
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        var obj = { stageData: {} };
        for (var j = 0; j < headers.length; j++) {
          var key = headers[j];
          var value = safeStr(r[j]);
          switch (key) {
            case 'id': obj.id = value; break;
            case 'datelogged': obj.dateLogged = value; break;
            case 'problemdescription': obj.description = value; break;
            case 'raisedby': obj.raisedBy = value; break;
            case 'assignedto': obj.assignedTo = value; break;
            case 'department': obj.department = value; break;
            case 'priority': obj.priority = value; break;
            case 'owner': obj.owner = value; break;
            case 'deadline': obj.deadline = value; break;
            case 'status': obj.status = value; break;
            case 'nextaction': obj.nextAction = value; break;
            case 'category': obj.category = value; break;
            case 'author': obj.author = value; break;
            case 'createdat': obj.createdAt = value; break;
            case 'updatedat': obj.updatedAt = value; break;
            case 'stagedatajson':
            case 'stagedata':
              try { obj.stageData = JSON.parse(value || '{}'); } catch (e) { obj.stageData = {}; }
              break;
            default:
              obj[key] = value;
          }
        }
        if (!obj.stageData) obj.stageData = {};
        out.push(obj);
      }
      return { success: true, data: out };
    } catch (e) { return { success: false, message: e.toString() }; }
  }

  function updateProblemStageColumns(sheet, rowIndex, stageData) {
    if (!stageData || typeof stageData !== 'object') return;
    var stageIndexMap = { p1: 0, p2: 1, p3: 2, p4: 3 };
    for (var sId in stageData) {
      var idx = stageIndexMap[sId];
      if (idx === undefined) continue;
      var sData = stageData[sId] || {};
      var baseCol = 16 + (idx * 2);  // 2 columns per stage: Planned (baseCol), Actual (baseCol+1)
      var planned = toTimestampDate(safeStr(sData.plannedDate || ''));
      var actual = toTimestampDate(safeStr(sData.actualDate || ''));
      sheet.getRange(rowIndex, baseCol).setValue(planned);
      sheet.getRange(rowIndex, baseCol + 1).setValue(actual);
    }
  }

  function saveProblem(data) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.PROBLEMS);
      if (!sheet) return { success: false, message: 'Sheet not found' };
      var id = data.id || ('PRB-' + Utilities.formatDate(new Date(), "GMT+5:30", "yyyyMMdd") + '-' + Math.floor(Math.random() * 9000 + 1000));
      var now = nowStr();
      var stageData = typeof data.stageData === 'string' ? parseJsonSafe(data.stageData) : data.stageData || {};
      if (!stageData || typeof stageData !== 'object') stageData = {};

      // Auto-populate planned dates for new problems based on stage weeks
      if (!data.id) {
        var createdDate = new Date(data.createdAt || now);
        
        // Get average resolution time from historical data if available
        var historicalStages = getHistoricalStageMetrics();
        
        var stageWeeks = [
          { id: 'p1', weeks: historicalStages.p1 || 1 },    // Report Logged
          { id: 'p2', weeks: historicalStages.p2 || 1 },    // Issue Analysis
          { id: 'p3', weeks: historicalStages.p3 || 1 },    // Resolution
          { id: 'p4', weeks: historicalStages.p4 || 0.5 }   // Closure
        ];
        
        var cumulativeDays = 0;
        for (var s = 0; s < stageWeeks.length; s++) {
          var stage = stageWeeks[s];
          if (!stageData[stage.id]) stageData[stage.id] = {};
          // Only set planned date if not already set
          if (!stageData[stage.id].plannedDate) {
            var plannedDate = new Date(createdDate);
            plannedDate.setDate(plannedDate.getDate() + cumulativeDays);
            stageData[stage.id].plannedDate = Utilities.formatDate(plannedDate, Session.getScriptTimeZone(), 'yyyy-MM-dd 00:00:00');
            stageData[stage.id].status = s === 0 ? 'In Progress' : 'Pending';
          }
          cumulativeDays += Math.ceil(stage.weeks * 7);
        }
      }
      
      // Auto-calculate actual dates based on when stages are marked complete
      if (data.stageData) {
        var newStageData = typeof data.stageData === 'string' ? parseJsonSafe(data.stageData) : data.stageData;
        for (var stageId in newStageData) {
          if (newStageData[stageId] && newStageData[stageId].actualDate && !stageData[stageId]) {
            stageData[stageId] = newStageData[stageId];
          } else if (newStageData[stageId]) {
            // If actual date is provided, auto-populate if missing
            if (newStageData[stageId].actualDate && (!stageData[stageId] || !stageData[stageId].actualDate)) {
              if (!stageData[stageId]) stageData[stageId] = {};
              stageData[stageId].actualDate = newStageData[stageId].actualDate;
              stageData[stageId].status = 'Completed';
            }
          }
        }
      }

      var rowData = [
        id, data.dateLogged || todayStr(), data.description, data.raisedBy, data.assignedTo || '',
        data.department, data.priority, data.owner, data.deadline, data.status, 
        data.nextAction, data.category || 'General', data.author || '', data.createdAt || now, now,
        JSON.stringify(stageData)
      ];

      var rowIndex = -1;
      if (data.id) {
        var rows = sheet.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (safeStr(rows[i][0]) === String(data.id)) {
            rowIndex = i + 1;
            sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
            break;
          }
        }
      }

      if (rowIndex === -1) {
        sheet.appendRow(rowData);
        rowIndex = sheet.getLastRow();
      }

      // Update the stageData JSON column
      sheet.getRange(rowIndex, 16).setValue(JSON.stringify(stageData));
      updateProblemStageColumns(sheet, rowIndex, stageData);
      return { success: true, id: id };
    } catch (e) { return { success: false, message: e.toString() }; }
  }

  function getHistoricalStageMetrics() {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.PROBLEMS);
      if (!sheet || sheet.getLastRow() <= 1) return { p1: 1, p2: 1, p3: 1, p4: 0.5 };
      
      var rows = sheet.getDataRange().getValues();
      var stageDurations = { p1: [], p2: [], p3: [], p4: [] };
      
      for (var i = 1; i < rows.length; i++) {
        var stageDataJson = safeStr(rows[i][14]);
        if (!stageDataJson) continue;
        try {
          var stageData = JSON.parse(stageDataJson);
          for (var stageId in stageData) {
            var stage = stageData[stageId];
            if (stage.plannedDate && stage.actualDate) {
              var planned = new Date(stage.plannedDate);
              var actual = new Date(stage.actualDate);
              var duration = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24 * 7)); // in weeks
              if (duration > 0 && stageDurations[stageId]) {
                stageDurations[stageId].push(duration);
              }
            }
          }
        } catch (e) {}
      }
      
      // Calculate averages
      var result = {};
      for (var sid in stageDurations) {
        var durations = stageDurations[sid];
        if (durations.length > 0) {
          var avg = durations.reduce(function(a,b) { return a + b; }, 0) / durations.length;
          result[sid] = Math.max(0.5, avg);
        } else {
          result[sid] = { p1: 1, p2: 1, p3: 1, p4: 0.5 }[sid] || 1;
        }
      }
      
      return result;
    } catch (e) {
      return { p1: 1, p2: 1, p3: 1, p4: 0.5 };
    }
  }

  function deleteProblem(id) {
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.PROBLEMS);
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (safeStr(rows[i][0]) === String(id)) {
          sheet.deleteRow(i + 1);
          return { success: true };
        }
      }
      return { success: false, message: 'Not found' };
    } catch (e) { return { success: false, message: e.toString() }; }
  }


// ──────────────────────────────────────────
//  HIREOS BRIDGE (bulk send only)
// ──────────────────────────────────────────

function getHireOsAppsScriptUrl_() {
  var url = PropertiesService.getScriptProperties().getProperty('HIREOS_APPS_SCRIPT_URL');
  return String(url || '').trim();
}

function callHireOs_(payload) {
  var url = getHireOsAppsScriptUrl_();
  if (!url) {
    return {
      status: 'error',
      message: 'Set Script Property HIREOS_APPS_SCRIPT_URL to the HireOS /exec web app URL.'
    };
  }
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'text/plain;charset=utf-8',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true
  });
  var text = res.getContentText() || '';
  try {
    return JSON.parse(text);
  } catch (e) {
    return {
      status: 'error',
      message: 'Invalid JSON from HireOS',
      details: text.substring(0, 400),
      httpStatus: res.getResponseCode()
    };
  }
}

/** google.script.run.getTeamPersonalityOverview() */
function getTeamPersonalityOverview() {
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.EMPLOYEES);
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        success: true,
        data: {
          counts: { D: 0, I: 0, S: 0, C: 0, other: 0 },
          totalCompleted: 0,
          pendingCount: 0,
          distribution: { D: 0, I: 0, S: 0, C: 0 },
          profiles: []
        }
      };
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();

    var discCol = -1;
    for (var h = 0; h < headers.length; h++) {
      if (String(headers[h]).trim().toLowerCase() === 'disc profile') {
        discCol = h;
        break;
      }
    }
    if (discCol === -1) {
      sheet.getRange(1, lastCol + 1).setValue('DISC Profile');
      headers = sheet.getRange(1, 1, 1, lastCol + 1).getValues()[0];
      lastCol = lastCol + 1;
      discCol = lastCol - 1;
      if (sheet.getLastRow() > 1) {
        rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
      }
    }

    function col(name) {
      var n = String(name).trim().toLowerCase();
      for (var i = 0; i < headers.length; i++) {
        if (String(headers[i]).trim().toLowerCase() === n) return i;
      }
      return -1;
    }

    var iId = col('Employee ID');
    var iName = col('Full Name');
    if (iName < 0) iName = col('Name');
    var iRole = col('Current Designation');
    if (iRole < 0) iRole = col('Designation');
    var iDept = col('Department');
    var iStatus = col('Status');

    var counts = { D: 0, I: 0, S: 0, C: 0, other: 0 };
    var profiles = [];
    var pendingCount = 0;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var id = iId >= 0 ? String(row[iId] || '').trim() : '';
      if (!id) continue;

      var name = iName >= 0 ? String(row[iName] || '').trim() : id;
      var role = iRole >= 0 ? String(row[iRole] || '').trim() : '';
      var department = iDept >= 0 ? String(row[iDept] || '').trim() : '';
      var status = iStatus >= 0 ? String(row[iStatus] || '').trim() : 'Active';
      var discProfile = String(row[discCol] || '').trim();
      var statusLower = status.toLowerCase();

      if (discProfile) {
        var letters = extractDiscLettersHr_(discProfile);
        var label = letters.length ? letters.join('') : discProfile.toUpperCase();
        if (letters.length) {
          // Dual/triple profiles share weight equally (SC → 0.5 S + 0.5 C)
          var weight = 1 / letters.length;
          for (var li = 0; li < letters.length; li++) {
            counts[letters[li]] += weight;
          }
        } else {
          counts.other++;
        }
        profiles.push({
          id: id,
          name: name,
          role: role,
          department: department,
          status: status,
          discProfile: discProfile,
          letters: letters,
          primary: label
        });
      } else if (!statusLower || statusLower === 'active') {
        pendingCount++;
      }
    }

    profiles.sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name));
    });

    var totalBars = counts.D + counts.I + counts.S + counts.C;
    var distribution = discDistributionPercentsHr_(counts, totalBars);

    return {
      success: true,
      data: {
        counts: {
          D: roundDiscCountHr_(counts.D),
          I: roundDiscCountHr_(counts.I),
          S: roundDiscCountHr_(counts.S),
          C: roundDiscCountHr_(counts.C),
          other: counts.other
        },
        totalCompleted: profiles.length,
        pendingCount: pendingCount,
        distribution: distribution,
        profiles: profiles
      }
    };
  } catch (e) {
    return { success: false, message: e.toString(), data: null };
  }
}

/** Unique D/I/S/C letters in profile order, e.g. "SC" → ["S","C"], "D/I" → ["D","I"] */
function extractDiscLettersHr_(profile) {
  var s = String(profile || '').trim().toUpperCase();
  var out = [];
  var seen = {};
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if ((ch === 'D' || ch === 'I' || ch === 'S' || ch === 'C') && !seen[ch]) {
      seen[ch] = true;
      out.push(ch);
    }
  }
  return out;
}

function primaryDiscLetterHr_(profile) {
  var letters = extractDiscLettersHr_(profile);
  return letters.length ? letters[0] : 'other';
}

function roundDiscCountHr_(n) {
  var v = Math.round((Number(n) || 0) * 10) / 10;
  return v % 1 === 0 ? Math.round(v) : v;
}

function discDistributionPercentsHr_(counts, totalBars) {
  if (!totalBars) return { D: 0, I: 0, S: 0, C: 0 };
  var keys = ['D', 'I', 'S', 'C'];
  var raw = keys.map(function (k) {
    return ((counts[k] || 0) / totalBars) * 100;
  });
  var floored = raw.map(function (p) {
    return Math.floor(p);
  });
  var rem = 100 - floored.reduce(function (a, b) {
    return a + b;
  }, 0);
  var order = keys
    .map(function (k, i) {
      return { i: i, frac: raw[i] - floored[i] };
    })
    .sort(function (a, b) {
      return b.frac - a.frac;
    });
  for (var r = 0; r < rem; r++) floored[order[r % order.length].i]++;
  return { D: floored[0], I: floored[1], S: floored[2], C: floored[3] };
}

/** google.script.run.sendBulkEmployeeDiscLinks()
 * Click once → queue eligible employees → return immediately.
 * Background trigger processDiscBulkQueue_ sends ~10 per run with random delays.
 */
function sendBulkEmployeeDiscLinks() {
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.EMPLOYEES);
    if (!sheet) return { success: false, message: 'Employees sheet not found.' };

    ensureDiscSentAtColumn_(sheet);
    var eligible = getDiscEligibleEmployeeIds_(sheet);
    if (!eligible.length) {
      return {
        success: true,
        queued: 0,
        message: 'No Active employees with empty DISC Profile and a phone number.',
      };
    }

    var props = PropertiesService.getScriptProperties();
    var existing = [];
    try {
      existing = JSON.parse(props.getProperty('DISC_BULK_QUEUE') || '[]');
      if (!Array.isArray(existing)) existing = [];
    } catch (e) {
      existing = [];
    }

    var seen = {};
    var queue = [];
    for (var i = 0; i < existing.length; i++) {
      var id0 = String(existing[i] || '').trim();
      if (id0 && !seen[id0]) {
        seen[id0] = true;
        queue.push(id0);
      }
    }
    for (var j = 0; j < eligible.length; j++) {
      var id1 = String(eligible[j] || '').trim();
      if (id1 && !seen[id1]) {
        seen[id1] = true;
        queue.push(id1);
      }
    }

    props.setProperty('DISC_BULK_QUEUE', JSON.stringify(queue));
    props.setProperty('DISC_BULK_STATUS', 'running');
    scheduleDiscBulkQueue_(60 * 1000);

    return {
      success: true,
      queued: queue.length,
      queuedIds: queue.slice(0, 80),
      message:
        'Background send started for ' +
        queue.length +
        ' employee(s). UI stays free — links go out in batches of ~10 with random delays.',
    };
  } catch (e) {
    return { success: false, message: 'Bulk send error: ' + e.toString() };
  }
}

/** Time-driven / chained: process up to 10 WhatsApp sends, then reschedule if needed. */
function processDiscBulkQueue_() {
  var props = PropertiesService.getScriptProperties();
  var queue = [];
  try {
    queue = JSON.parse(props.getProperty('DISC_BULK_QUEUE') || '[]');
    if (!Array.isArray(queue)) queue = [];
  } catch (e) {
    queue = [];
  }

  if (!queue.length) {
    props.setProperty('DISC_BULK_STATUS', 'idle');
    clearDiscBulkTriggers_();
    return { done: true, sent: 0 };
  }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.EMPLOYEES);
  if (!sheet) {
    props.setProperty('DISC_BULK_STATUS', 'error');
    return { done: true, sent: 0, message: 'Employees sheet missing' };
  }
  ensureDiscSentAtColumn_(sheet);

  var batchSize = 10;
  var delayMinSec = 12;
  var delayMaxSec = 35;
  var sent = 0;
  var attempted = 0;
  var remaining = queue.slice();

  while (remaining.length && sent < batchSize) {
    var empId = String(remaining.shift() || '').trim();
    if (!empId) continue;

    if (attempted > 0) {
      var span = delayMaxSec - delayMinSec;
      var waitSec =
        delayMinSec + (span > 0 ? Math.floor(Math.random() * (span + 1)) : 0);
      if (waitSec > 0) Utilities.sleep(waitSec * 1000);
    }
    attempted++;

    var result = callHireOs_({
      action: 'sendPsychometricTestLink',
      id: empId,
      entityType: 'Employee',
      force: true,
      allowResend: false,
    });

    var data = (result && result.data) || {};
    var skipped = !!(data.skipped);
    var ok =
      result &&
      result.status !== 'error' &&
      !skipped &&
      (data.link || result.status === 'success');

    // Count as delivered for UI if WhatsApp went out OR already pending/completed in HireOS
    if (
      ok ||
      (skipped &&
        (data.reason === 'ALREADY_SENT' || data.reason === 'ALREADY_COMPLETED'))
    ) {
      setEmployeeDiscSentAt_(sheet, empId);
      if (ok) sent++;
    } else if (result && result.status === 'error') {
      // Put back at end to retry next batch (transient HireOS/WAHA errors)
      remaining.push(empId);
    }
    // Other skips (NO_PHONE etc.) drop from queue
  }

  props.setProperty('DISC_BULK_QUEUE', JSON.stringify(remaining));
  if (remaining.length) {
    props.setProperty('DISC_BULK_STATUS', 'running');
    // Gap between batches (~2–4 min) before next 10
    var nextMs = (120 + Math.floor(Math.random() * 120)) * 1000;
    scheduleDiscBulkQueue_(nextMs);
  } else {
    props.setProperty('DISC_BULK_STATUS', 'idle');
    clearDiscBulkTriggers_();
  }

  return {
    done: remaining.length === 0,
    sent: sent,
    remaining: remaining.length,
  };
}

function getDiscBulkStatus() {
  var props = PropertiesService.getScriptProperties();
  var queue = [];
  try {
    queue = JSON.parse(props.getProperty('DISC_BULK_QUEUE') || '[]');
    if (!Array.isArray(queue)) queue = [];
  } catch (e) {
    queue = [];
  }
  return {
    success: true,
    status: props.getProperty('DISC_BULK_STATUS') || 'idle',
    remaining: queue.length,
  };
}

function ensureDiscSentAtColumn_(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim().toLowerCase() === 'disc sent at') return i;
  }
  sheet.getRange(1, lastCol + 1).setValue('DISC Sent At');
  return lastCol;
}

function getDiscEligibleEmployeeIds_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) {
    return String(h).trim();
  });
  var idCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'employee id';
  });
  var discCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'disc profile';
  });
  var sentCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'disc sent at';
  });
  var statusCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'status';
  });
  var phoneCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'mobile number';
  });
  if (idCol === -1) return [];

  var out = [];
  for (var i = 1; i < values.length; i++) {
    var empId = String(values[i][idCol] || '').trim();
    if (!empId) continue;
    var status =
      statusCol === -1
        ? 'active'
        : String(values[i][statusCol] || '')
            .trim()
            .toLowerCase();
    if (status && status !== 'active') continue;
    var disc =
      discCol === -1 ? '' : String(values[i][discCol] || '').trim();
    if (disc) continue;
    var alreadySent =
      sentCol === -1 ? '' : String(values[i][sentCol] || '').trim();
    if (alreadySent) continue;
    var phone =
      phoneCol === -1 ? '' : String(values[i][phoneCol] || '').trim();
    if (!phone) continue;
    out.push(empId);
  }
  return out;
}

function setEmployeeDiscSentAt_(sheet, employeeId) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  var headers = values[0].map(function (h) {
    return String(h).trim();
  });
  var idCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'employee id';
  });
  var sentCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'disc sent at';
  });
  if (idCol === -1) return;
  if (sentCol === -1) {
    sentCol = ensureDiscSentAtColumn_(sheet);
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    sentCol = headers.findIndex(function (h) {
      return String(h).trim().toLowerCase() === 'disc sent at';
    });
  }
  if (sentCol === -1) return;
  var stamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || 'Asia/Kolkata',
    'yyyy-MM-dd HH:mm:ss'
  );
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol] || '').trim() === String(employeeId).trim()) {
      sheet.getRange(i + 1, sentCol + 1).setValue(stamp);
      return;
    }
  }
}

function scheduleDiscBulkQueue_(afterMs) {
  clearDiscBulkTriggers_();
  // Apps Script time triggers require at least ~60s
  ScriptApp.newTrigger('processDiscBulkQueue_')
    .timeBased()
    .after(Math.max(60000, afterMs || 60000))
    .create();
}

function clearDiscBulkTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processDiscBulkQueue_') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/** google.script.run.sendEmployeeDiscLink(employeeId) */
function sendEmployeeDiscLink(employeeId) {
  try {
    var id = String(employeeId || '').trim();
    if (!id) {
      return { success: false, message: 'Employee ID is required.' };
    }

    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.EMPLOYEES);
    if (!sheet) {
      return { success: false, message: 'Employees sheet not found.' };
    }

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return { success: false, message: 'No employees found.' };
    }

    var headers = values[0].map(function (h) {
      return String(h).trim();
    });
    var idCol = headers.findIndex(function (h) {
      return h.toLowerCase() === 'employee id';
    });
    var discCol = headers.findIndex(function (h) {
      return h.toLowerCase() === 'disc profile';
    });
    var statusCol = headers.findIndex(function (h) {
      return h.toLowerCase() === 'status';
    });
    var phoneCol = headers.findIndex(function (h) {
      return h.toLowerCase() === 'mobile number';
    });
    var nameCol = headers.findIndex(function (h) {
      return h.toLowerCase() === 'full name' || h.toLowerCase() === 'name';
    });

    if (idCol === -1) {
      return { success: false, message: 'Employee ID column missing.' };
    }

    var row = null;
    var name = '';
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idCol] || '').trim() === id) {
        row = values[i];
        name = nameCol === -1 ? '' : String(row[nameCol] || '').trim();
        break;
      }
    }
    if (!row) {
      return { success: false, message: 'Employee not found: ' + id };
    }

    var status =
      statusCol === -1
        ? 'active'
        : String(row[statusCol] || '')
            .trim()
            .toLowerCase();
    if (status && status !== 'active') {
      return {
        success: false,
        message: (name || id) + ' is not Active — DISC link not sent.',
      };
    }

    var discProfile =
      discCol === -1 ? '' : String(row[discCol] || '').trim();
    if (discProfile) {
      return {
        success: false,
        alreadyDone: true,
        discProfile: discProfile,
        message: (name || id) + ' already has DISC Profile: ' + discProfile,
      };
    }

    var phone = phoneCol === -1 ? '' : String(row[phoneCol] || '').trim();
    if (!phone) {
      return {
        success: false,
        message: (name || id) + ' has no Mobile Number on file.',
      };
    }

    var result = callHireOs_({
      action: 'sendPsychometricTestLink',
      id: id,
      entityType: 'Employee',
      force: true,
      allowResend: true,
    });

    if (!result || result.status === 'error') {
      var why = (result && result.message) || 'HireOS send failed.';
      return { success: false, message: why, details: result && result.details };
    }

    var data = result.data || {};
    if (data.skipped) {
      if (data.reason === 'ALREADY_SENT' || data.reason === 'ALREADY_COMPLETED') {
        ensureDiscSentAtColumn_(sheet);
        setEmployeeDiscSentAt_(sheet, id);
        return {
          success: true,
          sent: true,
          already: true,
          id: id,
          name: name,
          message:
            data.reason === 'ALREADY_COMPLETED'
              ? (name || id) + ' already completed DISC.'
              : 'Link was already sent to ' + (name || id) + '.',
        };
      }
      return {
        success: false,
        skipped: true,
        reason: data.reason || 'SKIPPED',
        message: 'Not sent (' + (data.reason || 'skipped') + ')',
      };
    }

    ensureDiscSentAtColumn_(sheet);
    setEmployeeDiscSentAt_(sheet, id);
    return {
      success: true,
      sent: true,
      id: id,
      name: name,
      link: data.link || '',
      message: 'DISC link sent to ' + (name || id) + ' via WhatsApp.',
    };
  } catch (e) {
    return { success: false, message: 'Send error: ' + e.toString() };
  }
}
