import type { ExtractedDocument } from "./contracts";
import { field } from "./contracts";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

const money = (text: string | null | undefined) => text ? Number(text.replace(/[^\d.-]/g, "")) : null;
const match = (text: string, pattern: RegExp) => text.match(pattern)?.[1]?.trim() ?? null;

function emptyField<T>() { return field<T>(null, null, 0, true); }

export function extractText(text: string, filename: string): ExtractedDocument {
  const training = /course book|learning objectives|task\s+\d+\.\d+|chapter\s+\d+/i.test(text);
  const family = training ? "UNKNOWN" : /bank statement/i.test(text) || /statement/i.test(filename) ? "BANK_STATEMENT" : /payment voucher|\bPV[-\s]/i.test(text) ? "PAYMENT_VOUCHER" : /sales invoice|tax invoice[\s\S]*customer/i.test(text) ? "SALES_INVOICE" : /receipt/i.test(text + filename) ? "RECEIPT" : /invoice|inv[-\s]/i.test(text + filename) ? "PURCHASE_INVOICE" : "UNKNOWN";
  const supplierName = match(text, /(?:supplier|vendor|from|seller)\s*[:#-]?\s*([^\n]+)/i);
  const documentNumber = match(text, /(?:invoice|receipt|document|doc|reference)\s*(?:no\.?|number|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/]+)/i) ?? match(text, /\b((?:INV|PI|PV|OR|JV|CN|PR)-\d+)\b/i);
  const date = match(text, /(?:transaction\s+date|invoice\s+date|date|issued)\s*[:#-]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}[\s-]+[A-Za-z]{3,9}(?:,?\s+\d{2,4})?|[A-Za-z]{3,9}\s+\d{1,2}(?:,?\s+\d{2,4})?)/i);
  const currency = match(text, /\b(MYR|RM|USD|SGD|EUR)\b/i)?.toUpperCase().replace("RM", "MYR") ?? null;
  const totalLabels = "grand\\s+total|total\\s+due|total\\s+amount|total\\s+payable|invoice\\s+total|amount\\s+due|amount\\s+payable|net\\s+total";
  const totalRaw = match(text, new RegExp(`\\b(?:${totalLabels})\\b\\s*[:=]?\\s*\\(?\\s*(?:RM|MYR|USD|SGD|EUR)\\s*\\)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, "i")) ?? match(text, new RegExp(`\\b(?:${totalLabels})\\b\\s*[:=]?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, "i")) ?? match(text, /\btotal\b\s*[:=]?\s*\(?\s*(?:RM|MYR|USD|SGD|EUR)\s*\)?\s*([\d,]+(?:\.\d{1,2})?)/i) ?? match(text, /\btotal\b\s*[:=]?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const taxRaw = match(text, /\b(?:sst|tax|gst)(?:\s+amount)?\s*(?::|=|RM|MYR)\s*(?:RM|MYR)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const total = money(totalRaw); const tax = money(taxRaw);
  const subtotal = money(match(text, /\bsub\s*total\b\s*[:=]?\s*(?:RM|MYR|USD|SGD)?\s*([\d,]+(?:\.\d{1,2})?)/i));
  const make = <T>(value: T | null, raw = value === null ? null : String(value), confidence = value === null ? 0 : 0.88) => field(value, raw, confidence, value === null);
  return {
    source_text: text.slice(0, 180000),
    doc_family: family,
    supplier: { name: make(supplierName), tax_id: emptyField(), address: emptyField(), phone: emptyField(), email: emptyField() },
    customer: { name: emptyField(), tax_id: emptyField(), address: emptyField() },
    document: { number: make(documentNumber), date: make(date), due_date: emptyField(), currency: make(currency), po_number: emptyField(), terms: emptyField() },
    lines: [],
    totals: { subtotal: make<number>(subtotal), discount: make<number>(null), tax: make<number>(tax), total: make<number>(total), paid: make<number>(null) },
    quality: { pages: 1, is_scanned: !/[\w]+\s*[:=]/.test(text), rotation_fixed: false, overall_confidence: total !== null ? 0.84 : 0.42, unreadable_regions: total === null ? 1 : 0 },
  };
}

export function extractCsv(text: string): ExtractedDocument {
  const sheet = XLSX.read(text, { type: "string", raw: true }).Sheets.Sheet1;
  const doc = extractText(text, "statement.csv");
  doc.source_rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: "" });
  return doc;
}

export async function extractPdf(bytes: Uint8Array) {
  // Load inside the request so a PDF dependency failure is caught by the route,
  // and does not prevent spreadsheets or Word documents from being read.
  const canvas = await import("@napi-rs/canvas");
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.DOMMatrix ??= canvas.DOMMatrix;
  globals.ImageData ??= canvas.ImageData;
  globals.Path2D ??= canvas.Path2D;
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return { text: result.text, pages: typeof result.total === "number" ? result.total : result.pages?.length ?? 1, sourcePages: result.pages.map((p) => ({ page: p.num, text: p.text })) };
  } finally {
    await parser.destroy();
  }
}

export function extractSpreadsheet(bytes: Uint8Array, filename: string) {
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true });
  const text = workbook.SheetNames.map((name) => `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join("\n");
  const rows = workbook.SheetNames.flatMap((name) => XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[name], { raw: false, defval: "" }));
  return { text, rows, filename: filename.toLowerCase().includes("statement") ? "bank-statement.xlsx" : filename };
}

export async function extractDocx(bytes: Uint8Array) {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

export async function renderPdfPages(bytes: Uint8Array, pages: number[]) {
  const canvas = await import("@napi-rs/canvas");
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.DOMMatrix ??= canvas.DOMMatrix; globals.ImageData ??= canvas.ImageData; globals.Path2D ??= canvas.Path2D;
  const { PDFParse } = await import("pdf-parse");
  // PDF.js's default Node factory resolves canvas relative to its own pnpm
  // directory, whose optional dependency link is absent in a Vercel bundle.
  // Reuse the application's already-loaded native canvas instead.
  class ServerCanvasFactory {
    create(width: number, height: number) {
      const surface = canvas.createCanvas(Math.ceil(width), Math.ceil(height));
      return { canvas: surface, context: surface.getContext("2d") };
    }
    reset(target: { canvas: import("@napi-rs/canvas").Canvas }, width: number, height: number) {
      target.canvas.width = Math.ceil(width); target.canvas.height = Math.ceil(height);
    }
    destroy(target: { canvas: import("@napi-rs/canvas").Canvas }) {
      target.canvas.width = 0; target.canvas.height = 0;
    }
  }
  const parser = new PDFParse({ data: bytes, CanvasFactory: ServerCanvasFactory });
  try {
    const result = await parser.getScreenshot({ partial: pages, desiredWidth: 1500, imageBuffer: true, imageDataUrl: false });
    return result.pages.map((page) => ({ page: page.pageNumber, data: page.data }));
  } finally { await parser.destroy(); }
}
