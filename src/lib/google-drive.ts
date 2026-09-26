import "server-only";

import { googleRequest } from "./google-auth";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const DOCUMENTS_FOLDER_ID = process.env.HR_DOCUMENTS_FOLDER_ID || "";
const SHARED_DRIVE_ID = process.env.GOOGLE_DRIVE_ID || "";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);

export type AttachmentPayload = { name: string; mimeType: string; base64: string; size?: number };

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|#%{}~&]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "attachment";
}

async function findEmployeeFolder(folderName: string) {
  const q = [`name='${folderName.replace(/'/g, "\\'")}'`, `'${DOCUMENTS_FOLDER_ID}' in parents`, "mimeType='application/vnd.google-apps.folder'", "trashed=false"].join(" and ");
  const params = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "1", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
  if (SHARED_DRIVE_ID) {
    params.set("corpora", "drive");
    params.set("driveId", SHARED_DRIVE_ID);
  }
  const result = await googleRequest<{ files?: Array<{ id: string }> }>(`${DRIVE_BASE}/files?${params}`);
  return result.files?.[0]?.id || "";
}

async function createEmployeeFolder(folderName: string) {
  const query = SHARED_DRIVE_ID ? "?supportsAllDrives=true" : "";
  const result = await googleRequest<{ id: string }>(`${DRIVE_BASE}/files${query}`, {
    method: "POST",
    body: JSON.stringify({ name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [DOCUMENTS_FOLDER_ID] }),
  });
  return result.id;
}

export async function uploadHrAttachment(attachment: AttachmentPayload, employeeName: string, employeeKey: string, recordId: string) {
  if (!DOCUMENTS_FOLDER_ID) throw new Error("HR_DOCUMENTS_FOLDER_ID is not configured.");
  if (!attachment?.base64) throw new Error("Attachment data is missing.");
  if (!ALLOWED_MIME.has(attachment.mimeType)) throw new Error("Only PDF, Word, PNG, and JPG attachments are allowed.");
  const bytes = Buffer.from(attachment.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!bytes.length || bytes.length > MAX_BYTES || (attachment.size && attachment.size > MAX_BYTES)) throw new Error("Attachment must be smaller than 5 MB.");

  const folderName = `${safeName(employeeName)} [${employeeKey}]`;
  const parentId = await findEmployeeFolder(folderName) || await createEmployeeFolder(folderName);
  const fileName = `${safeName(recordId)} - ${safeName(attachment.name)}`;
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({ name: fileName, parents: [parentId] })], { type: "application/json" }));
  form.append("file", new Blob([bytes], { type: attachment.mimeType }), fileName);
  const result = await googleRequest<{ id: string; webViewLink?: string }>(
    `${UPLOAD_BASE}/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`,
    { method: "POST", body: form },
  );
  return { fileName: attachment.name, driveFileId: result.id, driveLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view` };
}

