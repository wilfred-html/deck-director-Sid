import fetch from 'node-fetch';
import fs from 'fs';
import { compileFromAirtable, getAirtableSnapshot } from './airtable';
import { renderSlidePreview } from './render';
import { generateImageViaOpenRouter } from './lib/openrouterImage';
import { buildGenerationPrompt, buildPromptPackage } from './lib/promptBuilder';
import { patchRecords, uploadAttachmentToGenerated } from './generate';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appb1sdK2880A8HYT';
const AIRTABLE_TOKEN = process.env.AIRTABLE_ACCESS_TOKEN || process.env.AIRTABLE_TOKEN || '';
const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';
const GENERATION_ENGINE = process.env.DECK_DIRECTOR_GENERATION_ENGINE || 'nano-banana-2';

const headers = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

async function createRecord(table: string, fields: Record<string, any>) {
  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!response.ok) throw new Error(`Failed to create Airtable record in ${table}: ${response.status}`);
  const data = await response.json() as { records: Array<{ id: string; fields: Record<string, any> }> };
  return data.records[0];
}

function buildPromptSummary(slide: any) {
  const refs = (slide.linkedReferences || []).map((ref: any) => ref.name).join(', ');
  return [
    `Slide ${slide.slideNumber}: ${slide.title}`,
    `Engine: ${GENERATION_ENGINE}`,
    `Model: ${OPENROUTER_IMAGE_MODEL}`,
    `Template: ${slide.targetTemplate}`,
    slide.visualBrief ? `Visual brief: ${slide.visualBrief}` : '',
    refs ? `References: ${refs}` : '',
    `Context window: ${slide.rollingContext.map((item: any) => item.slide_number).join(' -> ')}`,
  ].filter(Boolean).join('\n');
}

function buildLayoutJson(slide: any) {
  return JSON.stringify({
    slideNumber: slide.slideNumber,
    title: slide.title,
    subtitle: slide.subtitle,
    template: slide.targetTemplate,
    section: slide.section,
    intent: slide.intent,
    bullets: slide.bullets,
    body: slide.body,
    visualBrief: slide.visualBrief,
    mediaType: slide.mediaType,
    emphasis: slide.emphasis,
    rollingContext: slide.rollingContext,
    linkedReferences: (slide.linkedReferences || []).map((ref: any) => ({
      id: ref.id,
      name: ref.name,
      role: ref.role,
      imageUrl: ref.imageUrl,
    })),
  }, null, 2);
}

/**
 * Initialize a render run for single-slide generation.
 * Returns the run record so multiple single-slide calls can share it.
 */
export async function initRenderRun(versionId: string, totalSlides: number) {
  if (!AIRTABLE_TOKEN) throw new Error('Airtable token not configured on server.');

  const run = await createRecord('Render Runs', {
    'Run Name': `AI Generate ${new Date().toISOString()}`,
    'Run Type': 'Render',
    Status: 'Running',
    Model: OPENROUTER_IMAGE_MODEL,
    'Started At': new Date().toISOString(),
    'Log Summary': `AI-generating ${totalSlides} slides (one-at-a-time) from Airtable version ${versionId} using ${GENERATION_ENGINE}.`,
    'Deck Version': [versionId],
  });

  return { runId: run.id };
}

/**
 * Generate a single slide by slide number.
 */
export async function generateSingleSlide(versionId: string, slideNumber: number, runId?: string, excludeLogos?: boolean) {
  if (!AIRTABLE_TOKEN) throw new Error('Airtable token not configured on server.');

  const compiled = await compileFromAirtable(versionId);
  const snapshot = await getAirtableSnapshot();
  const targetVersionId = compiled.versionId || versionId || snapshot.versions[0]?.id;
  if (!targetVersionId) throw new Error('No Airtable deck version found.');

  const slide = compiled.compiledSlides.find((s) => s.slideNumber === slideNumber);
  if (!slide) throw new Error(`Slide number ${slideNumber} not found in compiled slides.`);

  const slideRowByNumber = new Map(
    snapshot.slideRows
      .filter((row) => row.versionIds.includes(targetVersionId))
      .map((row) => [Number(row.slide_number), row])
  );

  const sourceRow = slideRowByNumber.get(slide.slideNumber);
  const prompt = buildGenerationPrompt(slide, excludeLogos);
  const promptPackage = buildPromptPackage(slide, excludeLogos);

  const generated = await createRecord('Generated Slides', {
    'Generated Slide Name': `V${targetVersionId.slice(-4)} / Slide ${slide.slideNumber}`,
    Status: 'Generating',
    'Prompt Summary': buildPromptSummary(slide),
    'Layout JSON': buildLayoutJson(slide),
    Model: OPENROUTER_IMAGE_MODEL,
    'Iteration Number': 1,
    Notes: `AI-first slide generation via ${GENERATION_ENGINE}.`,
    'Deck Version': [targetVersionId],
    ...(sourceRow ? { 'Slide Row': [sourceRow.id] } : {}),
    ...(runId ? { 'Render Run': [runId] } : {}),
  });

  let imageOutput;
  try {
    imageOutput = await generateImageViaOpenRouter({
      model: OPENROUTER_IMAGE_MODEL,
      prompt,
      aspectRatio: '16:9',
      references: (slide.linkedReferences || [])
        .filter((reference: any) => reference?.imageUrl)
        .slice(0, 3)
        .map((reference: any) => ({
          url: reference.imageUrl,
          caption: reference.name,
        })),
    });
  } catch (error) {
    imageOutput = await renderSlidePreview(slide);
    await patchRecords('Generated Slides', [{
      id: generated.id,
      fields: {
        Notes: `AI generation failed; fallback preview rendered. Engine: ${GENERATION_ENGINE}. Error: ${error instanceof Error ? error.message.slice(0, 800) : 'Unknown error'}`,
      },
    }]);
  }

  await uploadAttachmentToGenerated(generated.id, 'Preview Image', imageOutput.filePath, imageOutput.fileName, imageOutput.contentType);
  if (sourceRow?.id) {
    await uploadAttachmentToGenerated(sourceRow.id, 'Generated Preview', imageOutput.filePath, imageOutput.fileName, imageOutput.contentType);
  }

  await patchRecords('Generated Slides', [{
    id: generated.id,
    fields: {
      Status: 'Succeeded',
      Notes: `Engine: ${GENERATION_ENGINE}\nPrompt package:\n${JSON.stringify(promptPackage, null, 2).slice(0, 90000)}`,
    },
  }]);

  if (sourceRow?.id) {
    await patchRecords('Slide Rows', [{
      id: sourceRow.id,
      fields: {
        'Generation Status': 'Succeeded',
        'Generated Layout JSON': buildLayoutJson(slide),
        'Last Generated At': new Date().toISOString(),
        ...(runId ? { 'Last Render Run': [runId] } : {}),
      },
    }]);
  }

  return {
    slideNumber: slide.slideNumber,
    generatedId: generated.id,
    slideRowId: sourceRow?.id,
    status: 'Succeeded',
    model: OPENROUTER_IMAGE_MODEL,
    engine: GENERATION_ENGINE,
  };
}

/**
 * Finalize a render run after all slides are done.
 */
export async function finalizeRenderRun(runId: string, generatedCount: number, versionId: string) {
  await patchRecords('Render Runs', [{
    id: runId,
    fields: {
      Status: 'Succeeded',
      'Finished At': new Date().toISOString(),
      'Log Summary': `Created ${generatedCount} AI-generated slide records (one-at-a-time) from Airtable version ${versionId} using ${GENERATION_ENGINE}.`,
    },
  }]);
}
