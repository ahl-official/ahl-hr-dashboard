// Builds the signed "Employee Master Database & Alignment Form" PDF. Pure: bytes in, bytes out.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfField = { label: string; value: string };
export type PdfInput = {
  company: string;
  employeeId: string;
  fullName: string;
  fields: PdfField[];
  signaturePng?: Uint8Array | null;
  logo?: { bytes: Uint8Array; type: "png" | "jpg" } | null;
  generatedAt?: Date;
};

const SECTIONS: Array<{ title: string; labels: string[] }> = [
  { title: "1. Employment & Tenure Details", labels: ["Employee ID", "Full Name", "Company", "Current Designation", "Department", "Reporting Manager", "Date of Joining (DOJ)", "Total Years of Experience", "Company E-mail ID"] },
  { title: "2. Personal & Statutory Identification", labels: ["Date of Birth", "Gender", "Blood Group", "Aadhar Card Number", "PAN Number", "Permanent Address", "Current Address", "Mobile Number", "Personal E-mail ID"] },
  { title: "3. Emergency Contact & Family Background", labels: ["Father’s Name", "Mother’s Name", "Number of Siblings", "Emergency Contact Name", "Relationship", "Emergency Contact Number"] },
  { title: "4. Banking, Payroll & Salary Information", labels: ["Bank Name", "Branch", "Account Number", "IFSC Code", "Last Drawn Salary"] },
  { title: "5. Senior Alignment & Professional Goals", labels: ["Short-term Goals", "Core Strengths", "Resource Requirements", "Alignment with Company Vision"] },
  { title: "6. Preferences & Additional Details", labels: ["Primary Hobbies", "Company Assets", "Dietary Preference", "Political Background", "Political Details", "Vehicle Ownership", "Housing Status"] },
];
const HIDDEN = new Set(["Timestamp", "PDF Link", "Digital Signature", "Date", "Current Salary", "Last Increment Year", "Increment Percentage"]);

const W = 595.28, H = 841.89, M = 40, LABEL_W = 165;
const INK = rgb(0.06, 0.09, 0.16), MUTED = rgb(0.39, 0.45, 0.55), BRAND = rgb(0.07, 0.4, 0.45), RULE = rgb(0.89, 0.91, 0.94);

/** Standard PDF fonts only cover Latin-1 plus a few typographic marks; anything else becomes "?". */
export function pdfSafe(text: string): string {
  return String(text ?? "").replace(/\r/g, "").replace(/[^\n\x20-\x7E\xA0-\xFF‘’“”–—•€]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of pdfSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      // break words that are wider than the column (long URLs, account numbers)
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
        if (line) { lines.push(line); line = ""; }
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else { lines.push(line); line = w; }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

export async function buildOnboardingPdf(input: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${pdfSafe(input.fullName)} - Employee Form`);
  pdf.setProducer("AHL HR Command Center");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const script = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const byLabel = new Map(input.fields.map((f) => [f.label, f.value]));
  const used = new Set<string>();

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const need = (h: number) => { if (y - h < M + 20) newPage(); };

  // Header: company logo + title
  if (input.logo) {
    const img = input.logo.type === "png" ? await pdf.embedPng(input.logo.bytes) : await pdf.embedJpg(input.logo.bytes);
    const s = Math.min(150 / img.width, 48 / img.height);
    page.drawImage(img, { x: M, y: y - img.height * s, width: img.width * s, height: img.height * s });
  } else {
    page.drawText(pdfSafe(input.company), { x: M, y: y - 16, size: 16, font: bold, color: BRAND });
  }
  page.drawText("Employee Master Database & Alignment Form", { x: W - M - bold.widthOfTextAtSize("Employee Master Database & Alignment Form", 10), y: y - 12, size: 10, font: bold, color: INK });
  const idLine = `Employee ID: ${pdfSafe(input.employeeId)}`;
  page.drawText(idLine, { x: W - M - bold.widthOfTextAtSize(idLine, 10), y: y - 28, size: 10, font: bold, color: BRAND });
  const gen = (input.generatedAt ?? new Date()).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  page.drawText(`Generated ${pdfSafe(gen)}`, { x: W - M - regular.widthOfTextAtSize(`Generated ${pdfSafe(gen)}`, 8), y: y - 42, size: 8, font: regular, color: MUTED });
  y -= 62;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: BRAND });
  y -= 18;

  const sectionHeader = (title: string) => {
    need(40);
    page.drawRectangle({ x: M, y: y - 16, width: W - 2 * M, height: 18, color: rgb(0.94, 0.98, 0.98) });
    page.drawText(pdfSafe(title), { x: M + 8, y: y - 11, size: 10, font: bold, color: BRAND });
    y -= 26;
  };
  const row = (label: string, value: string) => {
    const lines = wrap(value || "-", regular, 9.5, W - 2 * M - LABEL_W - 8);
    need(lines.length * 13 + 8);
    page.drawText(pdfSafe(label), { x: M + 8, y: y - 9, size: 8.5, font: regular, color: MUTED, maxWidth: LABEL_W - 12 });
    lines.forEach((ln, i) => page.drawText(ln, { x: M + LABEL_W, y: y - 10 - i * 13, size: 9.5, font: regular, color: INK }));
    y -= lines.length * 13 + 5;
    page.drawLine({ start: { x: M, y: y + 1 }, end: { x: W - M, y: y + 1 }, thickness: 0.4, color: RULE });
  };

  for (const s of SECTIONS) {
    sectionHeader(s.title);
    for (const label of s.labels) { row(label, byLabel.get(label) ?? ""); used.add(label); }
    y -= 8;
  }
  // anything the sheet has that the sections above don't know about
  const extra = input.fields.filter((f) => !used.has(f.label) && !HIDDEN.has(f.label));
  if (extra.length) { sectionHeader("Other details"); extra.forEach((f) => row(f.label, f.value)); y -= 8; }

  // Declaration + signature
  sectionHeader("Declaration & Signature");
  const decl = "I hereby declare that the information provided above is true and correct to the best of my knowledge, and I understand that any false statement may lead to disciplinary action.";
  const dl = wrap(decl, regular, 9, W - 2 * M - 16);
  need(dl.length * 12 + 110);
  dl.forEach((ln, i) => page.drawText(ln, { x: M + 8, y: y - 10 - i * 12, size: 9, font: regular, color: INK }));
  y -= dl.length * 12 + 14;
  const signedName = pdfSafe(byLabel.get("Digital Signature") || input.fullName);
  if (input.signaturePng) {
    const sig = await pdf.embedPng(input.signaturePng);
    const sc = Math.min(180 / sig.width, 60 / sig.height);
    page.drawImage(sig, { x: M + 8, y: y - sig.height * sc, width: sig.width * sc, height: sig.height * sc });
    y -= sig.height * sc + 4;
  } else {
    // signed by typing the name: shown in a signature-style italic
    page.drawText(signedName, { x: M + 8, y: y - 28, size: 20, font: script, color: INK });
    y -= 36;
  }
  page.drawLine({ start: { x: M + 8, y }, end: { x: M + 220, y }, thickness: 0.6, color: INK });
  page.drawText(signedName, { x: M + 8, y: y - 12, size: 9.5, font: bold, color: INK });
  page.drawText(`Declaration accepted online on ${pdfSafe(byLabel.get("Date") || "")}`, { x: M + 8, y: y - 25, size: 9, font: regular, color: MUTED });

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const t = `${pdfSafe(input.fullName)}  |  ${pdfSafe(input.employeeId)}  |  Page ${i + 1} of ${pages.length}`;
    p.drawText(t, { x: W / 2 - regular.widthOfTextAtSize(t, 8) / 2, y: 22, size: 8, font: regular, color: MUTED });
  });
  return pdf.save();
}
