import cors from 'cors';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { buildRedesignPlan } from './lib/redesignPlanner';
import { classifyMediaFromContext } from './lib/media';
import type { SlideModel } from './schemas/slide';
import { compilerStages, deckRowSchema, rollingWindowRule, designFormulaSystem } from './deckCompilerSpec';
import { ingestDeckRows } from './compiler';
import { compileFromAirtable, getAirtableSnapshot } from './airtable';
import { generateFromAirtable } from './generate';

const execFileAsync = promisify(execFile);
const app = express();
const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';
const GENERATION_ENGINE = process.env.DECK_DIRECTOR_GENERATION_ENGINE || 'nano-banana-2';
const HAS_OPENROUTER_KEY = Boolean(process.env.OPENROUTER_API_KEY);
const HAS_AIRTABLE_TOKEN = Boolean(process.env.AIRTABLE_ACCESS_TOKEN || process.env.AIRTABLE_TOKEN);
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appb1sdK2880A8HYT';

app.use(cors({ origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const upload = multer({
  dest: path.join(process.cwd(), 'tmp-uploads'),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const safe = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'deck';

type SlideAnalysis = {
  slideNumber: number;
  imageUrl: string;
  wordCount: number;
  lineCount: number;
  headingLength: number;
  densityScore: number;
  layoutScore: number;
  visualScore: number;
  consistencyScore: number;
  driftReasons: string[];
  template: 'hero' | 'divider' | 'text-image' | 'framework' | 'concept-grid' | 'summary';
  recommendation: 'keep' | 'light-cleanup' | 'rebuild';
  redesignPlan: ReturnType<typeof buildRedesignPlan>;
};

function scoreDensity(wordCount: number) {
  if (wordCount <= 18) return 95;
  if (wordCount <= 40) return 84;
  if (wordCount <= 65) return 71;
  if (wordCount <= 95) return 52;
  return 28;
}

function detectTemplate(slideNumber: number, wordCount: number, lineCount: number, headingLength: number): SlideAnalysis['template'] {
  if (slideNumber === 1) return 'hero';
  if (wordCount <= 12) return 'divider';
  if (wordCount >= 70) return 'framework';
  if (lineCount <= 6 && wordCount <= 35) return 'text-image';
  if (lineCount >= 7 && wordCount <= 55) return 'concept-grid';
  return 'summary';
}

function inferRecommendation(score: number): SlideAnalysis['recommendation'] {
  if (score >= 82) return 'keep';
  if (score >= 60) return 'light-cleanup';
  return 'rebuild';
}

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function runDeckAudit(filePath: string, originalName: string) {
  const auditId = `${Date.now()}-${safe(originalName)}`;
  const workDir = path.join(process.cwd(), 'uploads', auditId);
  const rendersDir = path.join(workDir, 'renders');
  await ensureDir(rendersDir);

  const normalizedPdf = path.join(workDir, 'deck.pdf');
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.pdf') {
    await fs.promises.copyFile(filePath, normalizedPdf);
  } else {
    throw new Error('MVP currently supports PDF upload. PPTX import is planned next.');
  }

  const info = await execFileAsync('pdfinfo', [normalizedPdf]);
  const pagesMatch = info.stdout.match(/Pages:\s+(\d+)/);
  const pages = Number(pagesMatch?.[1] || 0);

  if (!pages) throw new Error('Could not determine PDF page count.');

  await execFileAsync('pdftoppm', ['-jpeg', '-jpegopt', 'quality=86', '-scale-to', '1400', normalizedPdf, path.join(rendersDir, 'slide')]);
  const imageFiles = (await fs.promises.readdir(rendersDir))
    .filter((file) => file.endsWith('.jpg'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const slides: SlideAnalysis[] = [];

  for (let index = 1; index <= pages; index += 1) {
    const textFile = path.join(workDir, `slide-${index}.txt`);
    try {
      await execFileAsync('pdftotext', ['-f', String(index), '-l', String(index), normalizedPdf, textFile]);
    } catch {
      await fs.promises.writeFile(textFile, '');
    }

    const rawText = await fs.promises.readFile(textFile, 'utf8').catch(() => '');
    const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean);
    const words = rawText.trim().split(/\s+/).filter(Boolean);
    const headingLength = (lines[0] || '').length;
    const densityScore = scoreDensity(words.length);
    const layoutScore = Math.max(35, 100 - Math.max(0, lines.length - 8) * 8 - Math.max(0, headingLength - 42));
    const visualScore = Math.round((densityScore * 0.45) + (layoutScore * 0.55));
    const consistencyScore = Math.round((densityScore + layoutScore + visualScore) / 3);
    const driftReasons: string[] = [];

    if (words.length > 75) driftReasons.push('High text density — likely reads more like a document than a presentation slide.');
    if (headingLength > 44) driftReasons.push('Heading is long enough to risk awkward wrapping and hierarchy drift.');
    if (lines.length > 9) driftReasons.push('Too many text blocks/lines for a clean slide rhythm.');
    if (words.length <= 12 && index !== 1) driftReasons.push('Minimal-copy slide — should be treated as a deliberate divider, not a placeholder.');
    if (driftReasons.length === 0) driftReasons.push('Structure appears reasonably controlled for deck consistency.');

    const imageFile = imageFiles[index - 1];
    const template = detectTemplate(index, words.length, lines.length, headingLength);
    const slideModel: SlideModel = {
      slideNumber: index,
      intent:
        template === 'hero'
          ? 'hero'
          : template === 'divider'
            ? 'divider'
            : template === 'framework'
              ? 'framework'
              : template === 'summary'
                ? 'summary'
                : 'explain',
      rawText,
      wordCount: words.length,
      lineCount: lines.length,
      headingLength,
      elements: imageFile
        ? [
            {
              id: `slide-${index}-image`,
              type: 'image',
              role: index === 1 ? 'hero-image' : 'supporting-image',
              bbox: { x: 760, y: 120, w: 560, h: 420 },
              media: classifyMediaFromContext(rawText, index === 1 ? 'hero-image' : 'supporting-image'),
            },
          ]
        : [],
    };
    const redesignPlan = buildRedesignPlan(slideModel);

    slides.push({
      slideNumber: index,
      imageUrl: `/uploads/${auditId}/renders/${imageFile}`,
      wordCount: words.length,
      lineCount: lines.length,
      headingLength,
      densityScore,
      layoutScore,
      visualScore,
      consistencyScore,
      driftReasons,
      template,
      recommendation: inferRecommendation(consistencyScore),
      redesignPlan,
    });
  }

  const averageScore = Math.round(slides.reduce((sum, slide) => sum + slide.consistencyScore, 0) / slides.length);
  const rebuildSlides = slides.filter((slide) => slide.recommendation === 'rebuild').map((slide) => slide.slideNumber);
  const cleanupSlides = slides.filter((slide) => slide.recommendation === 'light-cleanup').map((slide) => slide.slideNumber);

  return {
    auditId,
    originalName,
    pageCount: pages,
    averageScore,
    summary: {
      keep: slides.filter((slide) => slide.recommendation === 'keep').length,
      lightCleanup: cleanupSlides.length,
      rebuild: rebuildSlides.length,
    },
    principles: [
      'Use one master visual system anchored to the best reference slide.',
      'Normalize slides into repeatable templates instead of unique one-offs.',
      'Reduce text density aggressively before polishing visuals.',
      'Keep image, icon, footer, and typography behavior consistent across sections.',
    ],
    slides,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'deck-director-api',
    runtime: {
      hasOpenRouterKey: HAS_OPENROUTER_KEY,
      imageModel: OPENROUTER_IMAGE_MODEL,
      generationEngine: GENERATION_ENGINE,
      hasAirtableToken: HAS_AIRTABLE_TOKEN,
      airtableBaseId: AIRTABLE_BASE_ID,
    },
  });
});

app.get('/api/compiler/spec', (_req, res) => {
  res.json({
    productDirection: 'row-driven deck compiler',
    summary: 'Deck Director is being rehauled from audit-first tooling into a spreadsheet-driven deck generation system with rolling local context and fixed global design memory.',
    rollingWindowRule,
    deckRowSchema,
    compilerStages,
    designFormulaSystem,
  });
});

app.get('/api/airtable/snapshot', async (_req, res) => {
  try {
    const snapshot = await getAirtableSnapshot();
    return res.json(snapshot);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch Airtable snapshot.' });
  }
});

app.get('/api/compiler/from-airtable', async (req, res) => {
  try {
    const compiled = await compileFromAirtable(typeof req.query.versionId === 'string' ? req.query.versionId : undefined);
    return res.json(compiled);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to compile from Airtable.' });
  }
});

app.post('/api/generate/from-airtable', async (req, res) => {
  try {
    const versionId = typeof req.body?.versionId === 'string' ? req.body.versionId : undefined;
    const result = await generateFromAirtable(versionId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate from Airtable.' });
  }
});

app.post('/api/compiler/ingest', upload.single('sheet'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV/XLSX/XLS uploaded.' });
  }

  try {
    const compiled = await ingestDeckRows(req.file.path, req.file.originalname);
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    return res.json(compiled);
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Compiler ingest failed.' });
  }
});

app.post('/api/audits', upload.single('deck'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No deck uploaded.' });
  }

  try {
    const result = await runDeckAudit(req.file.path, req.file.originalname);
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    return res.json(result);
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Audit failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`deck-director-api listening on ${PORT}`);
});
