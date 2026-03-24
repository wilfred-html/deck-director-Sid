import serverless from 'serverless-http';
import cors from 'cors';
import express from 'express';

// Ensure Netlify Functions use /tmp for writable paths
process.env.LAMBDA_TASK_ROOT = process.env.LAMBDA_TASK_ROOT || '/var/task';
import { buildRedesignPlan } from '../../server/src/lib/redesignPlanner';
import { classifyMediaFromContext } from '../../server/src/lib/media';
import type { SlideModel } from '../../server/src/schemas/slide';
import { compilerStages, deckRowSchema, rollingWindowRule, designFormulaSystem } from '../../server/src/deckCompilerSpec';
import { ingestDeckRows } from '../../server/src/compiler';
import { compileFromAirtable, getAirtableSnapshot, getGeneratedPresentation } from '../../server/src/airtable';
import { generateFromAirtable } from '../../server/src/generate';
import { applyEditedSlideVariant, createEditedSlideVariant } from '../../server/src/edit';
import { bulkRegenerateSlides } from '../../server/src/bulkRegenerate';
import { batchImportSlides } from '../../server/src/batchImport';
import { applyGlobalEdit } from '../../server/src/globalEdit';

const app = express();
const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';
const GENERATION_ENGINE = process.env.DECK_DIRECTOR_GENERATION_ENGINE || 'nano-banana-2';
const HAS_OPENROUTER_KEY = Boolean(process.env.OPENROUTER_API_KEY);
const HAS_AIRTABLE_TOKEN = Boolean(process.env.AIRTABLE_ACCESS_TOKEN || process.env.AIRTABLE_TOKEN);
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appb1sdK2880A8HYT';

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'deck-director-api-netlify',
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
    const excludeLogos = req.body?.excludeLogos === true;
    const result = await generateFromAirtable(versionId, excludeLogos);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate from Airtable.' });
  }
});

app.get('/api/generated/from-airtable', async (req, res) => {
  try {
    const presentation = await getGeneratedPresentation(typeof req.query.versionId === 'string' ? req.query.versionId : undefined);
    return res.json(presentation);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load generated presentation from Airtable.' });
  }
});

app.post('/api/generated/edit', async (req, res) => {
  try {
    const generatedSlideId = typeof req.body?.generatedSlideId === 'string' ? req.body.generatedSlideId : '';
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    const referenceImageUrls = Array.isArray(req.body?.referenceImageUrls) ? req.body.referenceImageUrls.filter((item: unknown) => typeof item === 'string') : [];
    if (!generatedSlideId || !prompt.trim()) {
      return res.status(400).json({ error: 'generatedSlideId and prompt are required.' });
    }
    const result = await createEditedSlideVariant(generatedSlideId, prompt.trim(), referenceImageUrls);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create edited slide variant.' });
  }
});

app.post('/api/generated/edit/apply', async (req, res) => {
  try {
    const generatedSlideId = typeof req.body?.generatedSlideId === 'string' ? req.body.generatedSlideId : '';
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    const tempFilePath = typeof req.body?.tempFilePath === 'string' ? req.body.tempFilePath : '';
    const tempFileName = typeof req.body?.tempFileName === 'string' ? req.body.tempFileName : '';
    const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType : '';
    if (!generatedSlideId || !prompt || !tempFilePath || !tempFileName || !contentType) {
      return res.status(400).json({ error: 'generatedSlideId, prompt, tempFilePath, tempFileName, and contentType are required.' });
    }
    const result = await applyEditedSlideVariant({ generatedSlideId, prompt, tempFilePath, tempFileName, contentType });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to apply edited slide variant.' });
  }
});

app.post('/api/bulk/regenerate', async (req, res) => {
  try {
    const versionId = typeof req.body?.versionId === 'string' ? req.body.versionId : '';
    const referenceImageUrls = Array.isArray(req.body?.referenceImageUrls) ? req.body.referenceImageUrls.filter((item: unknown) => typeof item === 'string') : [];
    if (!versionId) {
      return res.status(400).json({ error: 'versionId is required.' });
    }
    if (referenceImageUrls.length === 0) {
      return res.status(400).json({ error: 'At least one reference image URL is required.' });
    }
    const result = await bulkRegenerateSlides(versionId, referenceImageUrls);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to bulk regenerate slides.' });
  }
});

app.post('/api/global/edit', async (req, res) => {
  try {
    const versionId = typeof req.body?.versionId === 'string' ? req.body.versionId : '';
    const editPrompt = typeof req.body?.editPrompt === 'string' ? req.body.editPrompt : '';
    const referenceImageUrls = Array.isArray(req.body?.referenceImageUrls) ? req.body.referenceImageUrls.filter((item: unknown) => typeof item === 'string') : [];
    if (!versionId) {
      return res.status(400).json({ error: 'versionId is required.' });
    }
    if (!editPrompt.trim()) {
      return res.status(400).json({ error: 'editPrompt is required.' });
    }
    const result = await applyGlobalEdit(versionId, editPrompt.trim(), referenceImageUrls);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to apply global edit.' });
  }
});

export const handler = serverless(app);
