// AHL HR file uploader. The dashboard server posts a file here; it is saved in the HR Dashboard folder
// in Drive AS THE OWNER of this script (a Google service account has no storage of its own).
// Protected by a shared secret, so only the dashboard server can use it.
const PARENT_FOLDER_NAME = 'HR Dashboard'; // looked up by name (must contain a '01_Database' folder)
const ROOT_FOLDER_NAME = '03_Employee_Documents';
const SECRET = '__SECRET__';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

function doGet() {
  return json_({ ok: true, service: 'AHL HR uploader' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json_({ ok: false, error: 'unauthorized' });
    const folderName = clean_(body.folderName);
    const fileName = clean_(body.fileName);
    if (!folderName || !fileName) throw new Error('folderName and fileName are required');
    if (ALLOWED.indexOf(body.mimeType) < 0) throw new Error('File type not allowed');
    const bytes = Utilities.base64Decode(body.base64 || '');
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('File must be between 1 byte and 10 MB');

    const root = child_(parent_(), ROOT_FOLDER_NAME);
    const folder = child_(root, folderName);
    // Idempotent: the same file name in the same folder means this is a retry, so reuse the file
    // instead of saving a duplicate.
    const existing = folder.getFilesByName(fileName);
    const file = existing.hasNext() ? existing.next() : folder.createFile(Utilities.newBlob(bytes, body.mimeType, fileName));
    return json_({ ok: true, fileId: file.getId(), url: file.getUrl(), folderUrl: folder.getUrl() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function parent_() {
  const it = DriveApp.getFoldersByName(PARENT_FOLDER_NAME);
  while (it.hasNext()) {
    const f = it.next();
    if (f.getFoldersByName('01_Database').hasNext()) return f;
  }
  throw new Error('Folder "' + PARENT_FOLDER_NAME + '" (with 01_Database inside) was not found in this Drive');
}
function child_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function clean_(s) {
  return String(s || '').replace(/[\/:*?"<>|#%{}~&]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
