import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { compilerStages, deckRowSchema, rollingWindowRule } from './deckCompilerSpec';

export type DeckRowRecord = Record<string, string>;

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const headerAliases: Record<string, string> = {
  slidenumber: 'slide_number',
  slide: 'slide_number',
  sectionname: 'section',
  slidetype: 'intent',
  layout: 'layout_type',
  layouttype: 'layout_type',
  visualbrief: 'visual_brief',
  mediatype: 'media_type',
  charttype: 'chart_type',
  speakernotes: 'speaker_notes',
  mustkeep: 'must_keep',
  referenceimageids: 'reference_image_ids',
  designnotes: 'design_notes',
};

function canonicalizeHeader(value: string) {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headerAliases[compact] || normalizeKey(value);
}

function parseCsv(text: string): DeckRowRecord[] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current.trim());
    if (row.some((cell) => cell !== '')) rows.push(row);
  }

  const [headerRow, ...body] = rows;
  if (!headerRow) return [];
  const headers = headerRow.map(canonicalizeHeader);

  return body.map((values) => {
    const record: DeckRowRecord = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] || '').trim();
    });
    return record;
  });
}

function parseWorkbook(filePath: string): DeckRowRecord[] {
  const workbook = XLSX.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
  return json.map((row) => {
    const normalized: DeckRowRecord = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[canonicalizeHeader(key)] = String(value ?? '').trim();
    });
    return normalized;
  });
}

function validateRows(rows: DeckRowRecord[]) {
  const requiredFields = deckRowSchema.filter((field) => field.required).map((field) => field.key);
  return rows.map((row, index) => {
    const missing = requiredFields.filter((field) => !row[field]);
    return {
      rowNumber: index + 1,
      missing,
      valid: missing.length === 0,
    };
  });
}

function rollingContextFor(index: number, rows: DeckRowRecord[]) {
  const start = Math.max(0, index - rollingWindowRule.lookbackRows);
  return rows.slice(start, index + 1).map((row) => ({
    slide_number: row.slide_number,
    title: row.title,
    section: row.section,
    intent: row.intent,
    layout_type: row.layout_type,
  }));
}

function chooseTemplate(row: DeckRowRecord) {
  if (row.layout_type) return row.layout_type;
  switch (row.intent) {
    case 'cover': return 'hero';
    case 'divider': return 'divider-left';
    case 'timeline': return 'timeline-horizontal';
    case 'framework': return 'framework-3-card';
    case 'quote': return 'quote-impact';
    case 'summary': return 'summary-grid';
    default: return 'text-image-7-5';
  }
}

export function compileRows(rows: DeckRowRecord[]) {
  const validation = validateRows(rows);
  const invalidRows = validation.filter((item) => !item.valid);

  const compiledSlides = rows.map((row, index) => ({
    slideNumber: Number(row.slide_number || index + 1),
    section: row.section,
    intent: row.intent,
    targetTemplate: chooseTemplate(row),
    title: row.title,
    subtitle: row.subtitle || '',
    body: row.body || '',
    bullets: row.bullets ? row.bullets.split(/\||\n/).map((item) => item.trim()).filter(Boolean) : [],
    visualBrief: row.visual_brief || '',
    mediaType: row.media_type || 'unknown',
    emphasis: row.emphasis || 'balanced',
    rollingContext: rollingContextFor(index, rows),
  }));

  return {
    rowCount: rows.length,
    validRowCount: validation.filter((item) => item.valid).length,
    invalidRows,
    compilerStages,
    compiledSlides,
  };
}

export async function ingestDeckRows(filePath: string, originalName: string) {
  const ext = path.extname(originalName).toLowerCase();
  const text = ext === '.csv' ? await fs.promises.readFile(filePath, 'utf8') : null;
  const rows = ext === '.csv'
    ? parseCsv(text || '')
    : ['.xlsx', '.xls'].includes(ext)
      ? parseWorkbook(filePath)
      : [];

  if (!rows.length) {
    throw new Error('No usable rows found. Upload a CSV/XLSX/XLS with a header row.');
  }

  return compileRows(rows);
}
