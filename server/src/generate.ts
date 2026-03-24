import fetch from 'node-fetch';
import fs from 'fs';
import { compileFromAirtable, getAirtableSnapshot } from './airtable';
import { renderSlidePreview } from './render';
import { generateImageViaOpenRouter } from './lib/openrouterImage';
import { buildGenerationPrompt, buildPromptPackage } from './lib/promptBuilder';

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

export async function patchRecords(table: string, records: Array<{ id: string; fields: Record<string, any> }>) {
  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ records }),
  });
  if (!response.ok) throw new Error(`Failed to patch Airtable records in ${table}: ${response.status}`);
  return response.json();
}

export async function uploadAttachmentToGenerated(recordId: string, fieldIdOrName: string, filePath: string, filename: string, contentType: string) {
  const file = await fs.promises.readFile(filePath);
  const payload = {
    contentType,
    filename,
    file: file.toString('base64'),
  };

  const response = await fetch(`https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${recordId}/${fieldIdOrName}/uploadAttachment`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Failed to upload attachment to Airtable: ${response.status}`);
  return response.json();
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

export async function generateFromAirtable(versionId?: string, excludeLogos?: boolean) {
  if (!AIRTABLE_TOKEN) throw new Error('Airtable token not configured on server.');

  const compiled = await compileFromAirtable(versionId);
  const snapshot = await getAirtableSnapshot();
  const targetVersionId = compiled.versionId || versionId || snapshot.versions[0]?.id;
  if (!targetVersionId) throw new Error('No Airtable deck version found to generate from.');

  const run = await createRecord('Render Runs', {
    'Run Name': `AI Generate ${new Date().toISOString()}`,
    'Run Type': 'Render',
    Status: 'Running',
    Model: OPENROUTER_IMAGE_MODEL,
    'Started At': new Date().toISOString(),
    'Log Summary': `AI-generating ${compiled.compiledSlides.length} slides from Airtable version ${targetVersionId} using ${GENERATION_ENGINE}.`,
    'Deck Version': [targetVersionId],
  });

  const slideRowByNumber = new Map(
    snapshot.slideRows
      .filter((row) => row.versionIds.includes(targetVersionId))
      .map((row) => [Number(row.slide_number), row])
  );

  const generatedRecords: Array<{ slideNumber: number; generatedId: string; slideRowId?: string }> = [];

  // Visual chaining: store generated slide data URLs for lookback
  const LOOKBACK = 2;
  const generatedDataUrls: Array<{ slideNumber: number; dataUrl: string }> = [];

  try {
    for (const slide of compiled.compiledSlides) {
      const sourceRow = slideRowByNumber.get(slide.slideNumber);
      const prompt = buildGenerationPrompt(slide, excludeLogos);
      const promptPackage = buildPromptPackage(slide, excludeLogos);

      // Build references: design references + previous generated slides
      const designRefs = (slide.linkedReferences || [])
        .filter((reference: any) => reference?.imageUrl)
        .slice(0, 3)
        .map((reference: any) => ({
          url: reference.imageUrl,
          caption: `Design reference: ${reference.name}`,
        }));

      // Add lookback slides for visual continuity
      const lookbackRefs = generatedDataUrls
        .slice(-LOOKBACK)
        .map((prev) => ({
          url: prev.dataUrl,
          caption: `Previously generated slide ${prev.slideNumber} — maintain visual consistency with this slide's style, colours, typography, and composition`,
        }));

      const allReferences = [...designRefs, ...lookbackRefs];

      const generated = await createRecord('Generated Slides', {
        'Generated Slide Name': `V${targetVersionId.slice(-4)} / Slide ${slide.slideNumber}`,
        Status: 'Generating',
        'Prompt Summary': buildPromptSummary(slide),
        'Layout JSON': buildLayoutJson(slide),
        Model: OPENROUTER_IMAGE_MODEL,
        'Iteration Number': 1,
        Notes: `AI-first slide generation via ${GENERATION_ENGINE}. Visual chaining: ${lookbackRefs.length} lookback slide(s).`,
        'Deck Version': [targetVersionId],
        ...(sourceRow ? { 'Slide Row': [sourceRow.id] } : {}),
        'Render Run': [run.id],
      });

      let imageOutput;
      try {
        imageOutput = await generateImageViaOpenRouter({
          model: OPENROUTER_IMAGE_MODEL,
          prompt: prompt + (lookbackRefs.length
            ? `\n\nVISUAL CHAINING: ${lookbackRefs.length} previously generated slide(s) are included as reference images. Match their visual style, colour palette, typography weight, and composition grid closely. These slides are from the SAME deck — they must look like they belong together.`
            : ''),
          aspectRatio: '16:9',
          references: allReferences,
        });

        // Store the data URL for future slides to reference
        if (imageOutput.dataUrl) {
          generatedDataUrls.push({ slideNumber: slide.slideNumber, dataUrl: imageOutput.dataUrl });
        }
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

      generatedRecords.push({ slideNumber: slide.slideNumber, generatedId: generated.id, slideRowId: sourceRow?.id });
    }

    const slideRowUpdates = generatedRecords
      .filter((item) => item.slideRowId)
      .map((item) => ({
        id: item.slideRowId as string,
        fields: {
          'Generation Status': 'Succeeded',
          'Generated Layout JSON': buildLayoutJson(compiled.compiledSlides.find((slide) => slide.slideNumber === item.slideNumber)),
          'Last Generated At': new Date().toISOString(),
          'Last Render Run': [run.id],
        },
      }));

    if (slideRowUpdates.length) {
      for (let i = 0; i < slideRowUpdates.length; i += 10) {
        await patchRecords('Slide Rows', slideRowUpdates.slice(i, i + 10));
      }
    }

    await patchRecords('Render Runs', [{
      id: run.id,
      fields: {
        Status: 'Succeeded',
        'Finished At': new Date().toISOString(),
        'Log Summary': `Created ${generatedRecords.length} AI-generated slide records from Airtable version ${targetVersionId} using ${GENERATION_ENGINE}.`,
      },
    }]);

    return {
      runId: run.id,
      versionId: targetVersionId,
      generatedCount: generatedRecords.length,
      generatedRecords,
      model: OPENROUTER_IMAGE_MODEL,
      engine: GENERATION_ENGINE,
    };
  } catch (error) {
    await patchRecords('Render Runs', [{
      id: run.id,
      fields: {
        Status: 'Failed',
        'Finished At': new Date().toISOString(),
        'Log Summary': `AI generation failed for version ${targetVersionId}: ${error instanceof Error ? error.message.slice(0, 900) : 'Unknown error'}`,
      },
    }]).catch(() => undefined);
    throw error;
  }
}
