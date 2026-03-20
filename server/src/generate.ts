import fetch from 'node-fetch';
import { compileFromAirtable, getAirtableSnapshot } from './airtable';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appb1sdK2880A8HYT';
const AIRTABLE_TOKEN = process.env.AIRTABLE_ACCESS_TOKEN || process.env.AIRTABLE_TOKEN || '';
const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';

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

async function patchRecords(table: string, records: Array<{ id: string; fields: Record<string, any> }>) {
  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ records }),
  });
  if (!response.ok) throw new Error(`Failed to patch Airtable records in ${table}: ${response.status}`);
  return response.json();
}

function buildPromptSummary(slide: any) {
  const refs = (slide.linkedReferences || []).map((ref: any) => ref.name).join(', ');
  return [
    `Slide ${slide.slideNumber}: ${slide.title}`,
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

export async function generateFromAirtable(versionId?: string) {
  if (!AIRTABLE_TOKEN) throw new Error('Airtable token not configured on server.');

  const compiled = await compileFromAirtable(versionId);
  const snapshot = await getAirtableSnapshot();
  const targetVersionId = compiled.versionId || versionId || snapshot.versions[0]?.id;
  if (!targetVersionId) throw new Error('No Airtable deck version found to generate from.');

  const run = await createRecord('Render Runs', {
    'Run Name': `Render ${new Date().toISOString()}`,
    'Run Type': 'Render',
    Status: 'Running',
    Model: OPENROUTER_IMAGE_MODEL,
    'Started At': new Date().toISOString(),
    'Log Summary': `Generating ${compiled.compiledSlides.length} slides from Airtable version ${targetVersionId}`,
    'Deck Version': [targetVersionId],
  });

  const slideRowByNumber = new Map(
    snapshot.slideRows
      .filter((row) => row.versionIds.includes(targetVersionId))
      .map((row) => [Number(row.slide_number), row])
  );

  const generatedRecords: Array<{ slideNumber: number; generatedId: string; slideRowId?: string }> = [];

  for (const slide of compiled.compiledSlides) {
    const sourceRow = slideRowByNumber.get(slide.slideNumber);
    const generated = await createRecord('Generated Slides', {
      'Generated Slide Name': `V${targetVersionId.slice(-4)} / Slide ${slide.slideNumber}`,
      Status: 'Succeeded',
      'Prompt Summary': buildPromptSummary(slide),
      'Layout JSON': buildLayoutJson(slide),
      Model: OPENROUTER_IMAGE_MODEL,
      'Iteration Number': 1,
      Notes: 'Phase 1 output: structured generation record created from Airtable compile. Preview image rendering still to be added.',
      'Deck Version': [targetVersionId],
      ...(sourceRow ? { 'Slide Row': [sourceRow.id] } : {}),
      'Render Run': [run.id],
    });

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
      'Log Summary': `Created ${generatedRecords.length} generated slide records from Airtable version ${targetVersionId}.`,
    },
  }]);

  return {
    runId: run.id,
    versionId: targetVersionId,
    generatedCount: generatedRecords.length,
    generatedRecords,
    model: OPENROUTER_IMAGE_MODEL,
  };
}
