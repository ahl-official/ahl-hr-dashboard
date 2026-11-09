import { jsPDF } from "jspdf";
import { formatReportPosition, reportTitle } from "./fms-report.ts";
import type { FmsReport } from "./fms-report.ts";

const MARGIN = 20;
const ROW_HEIGHT = 10;

/** Lays the report out like the coordinator's template: summary table, joined table, position list. */
export function renderFmsReportPdf(report: FmsReport): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - MARGIN * 2;
  let y = 28;

  const ensureRoom = (height: number) => {
    if (y + height > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const drawRow = (cells: Array<{ text: string; width: number; align?: "left" | "center" }>, bold = false) => {
    ensureRoom(ROW_HEIGHT);
    let x = MARGIN;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    for (const cell of cells) {
      doc.rect(x, y, cell.width, ROW_HEIGHT);
      const text = doc.splitTextToSize(cell.text, cell.width - 6)[0] ?? "";
      if (cell.align === "center") doc.text(text, x + cell.width / 2, y + 6.5, { align: "center" });
      else doc.text(text, x + 3, y + 6.5);
      x += cell.width;
    }
    y += ROW_HEIGHT;
  };

  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(14);
  doc.text(reportTitle(report), pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(11);
  doc.setLineWidth(0.2);
  const labelWidth = tableWidth * 0.7;
  const valueWidth = tableWidth - labelWidth;
  const summary: Array<[string, number]> = [
    ["Total no. of shortlisted candidates", report.totals.shortlisted],
    ["Total no. of candidates JOINED", report.totals.joined],
    ["Total no. of candidates required", report.totals.required],
  ];
  for (const [label, value] of summary) {
    drawRow([{ text: label, width: labelWidth }, { text: String(value), width: valueWidth, align: "center" }]);
  }
  y += 10;

  const widths = [tableWidth * 0.14, tableWidth * 0.5, tableWidth * 0.36];
  drawRow(
    [
      { text: "Sr no.", width: widths[0], align: "center" },
      { text: "Name", width: widths[1] },
      { text: "Post", width: widths[2] },
    ],
    true
  );
  if (report.joinedCandidates.length === 0) {
    drawRow([{ text: "No candidates joined in this period", width: tableWidth, align: "center" }]);
  }
  report.joinedCandidates.forEach((c, i) => {
    drawRow([
      { text: `${i + 1}.`, width: widths[0], align: "center" },
      { text: c.name, width: widths[1] },
      { text: c.post, width: widths[2] },
    ]);
  });
  y += 10;

  doc.setFont("helvetica", "normal");
  if (report.positions.length === 0) {
    ensureRoom(6);
    doc.text("No open positions.", MARGIN, y);
  }
  report.positions.forEach((position, i) => {
    const lines: string[] = doc.splitTextToSize(formatReportPosition(position), tableWidth - 8);
    ensureRoom(lines.length * 5.5 + 1.5);
    doc.text(`${i + 1}.`, MARGIN, y);
    doc.text(lines, MARGIN + 8, y);
    y += lines.length * 5.5 + 1.5;
  });

  return doc;
}
