import fetch from 'node-fetch';
import { compileRows, type DeckRowRecord } from './compiler';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appb1sdK2880A8HYT';
const AIRTABLE_TOKEN = process.env.AIRTABLE_ACCESS_TOKEN || process.env.AIRTABLE_TOKEN || '';

const headers = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

type AirtableListResponse = {
  records: Array<{ id: string; fields: Record<string, any> }>;
  offset?: string;
};

async function listAll(tableName: string, query = '') {
  const records: AirtableListResponse['records'] = [];
  let offset = '';

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`);
    if (query) {
      const params = new URLSearchParams(query);
      params.forEach((value, key) => url.searchParams.append(key, value));
    }
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`Airtable fetch failed for ${tableName}: ${response.status}`);
    }

    const data = (await response.json()) as AirtableListResponse;
    records.push(...data.records);
    offset = data.offset || '';
  } while (offset);

  return records;
}

export async function getAirtableSnapshot() {
  if (!AIRTABLE_TOKEN) throw new Error('Airtable token not configured on the server.');

  const [decks, versions, refs, rows] = await Promise.all([
    listAll('Decks'),
    listAll('Deck Versions'),
    listAll('Reference Styles'),
    listAll('Slide Rows', 'sort[0][field]=Slide Number&sort[0][direction]=asc'),
  ]);

  return {
    baseId: AIRTABLE_BASE_ID,
    decks: decks.map((record) => ({
      id: record.id,
      name: record.fields['Deck Name'] || 'Untitled Deck',
      status: record.fields.Status || '',
      currentVersion: record.fields['Current Version'] || '',
      brandClient: record.fields['Brand / Client'] || '',
      description: record.fields.Description || '',
    })),
    versions: versions.map((record) => ({
      id: record.id,
      name: record.fields['Version Name'] || 'Untitled Version',
      number: record.fields['Version Number'] || '',
      status: record.fields.Status || '',
      compilerMode: record.fields['Compiler Mode'] || '',
      deckIds: record.fields.Deck || [],
    })),
    referenceStyles: refs.map((record) => ({
      id: record.id,
      name: record.fields['Style Reference'] || 'Unnamed Reference',
      role: record.fields.Role || '',
      mediaWorld: record.fields['Media World'] || '',
      styleNotes: record.fields['Style Notes'] || '',
      keywords: record.fields.Keywords || '',
      imageUrl: record.fields.Image?.[0]?.url || '',
      deckIds: record.fields.Deck || [],
    })),
    slideRows: rows.map((record) => ({
      id: record.id,
      versionIds: record.fields['Deck Version'] || [],
      referenceStyleIds: record.fields['Reference Styles'] || [],
      slide_number: String(record.fields['Slide Number'] || ''),
      section: record.fields.Section || '',
      intent: record.fields.Intent || '',
      layout_type: record.fields['Layout Type'] || '',
      title: record.fields.Title || '',
      subtitle: record.fields.Subtitle || '',
      body: record.fields.Body || '',
      bullets: record.fields.Bullets || '',
      visual_brief: record.fields['Visual Brief'] || '',
      media_type: record.fields['Media Type'] || '',
      chart_type: record.fields['Chart Type'] || '',
      speaker_notes: record.fields['Speaker Notes'] || '',
      must_keep: record.fields['Must Keep'] || '',
      emphasis: record.fields.Emphasis || '',
      reference_image_ids: record.fields['Reference Image IDs'] || '',
      design_notes: record.fields['Design Notes'] || '',
    })),
  };
}

export async function compileFromAirtable(versionId?: string) {
  const snapshot = await getAirtableSnapshot();
  const targetVersionId = versionId || snapshot.versions[0]?.id;

  const rows = snapshot.slideRows.filter((row) => !targetVersionId || row.versionIds.includes(targetVersionId));
  const compiled = compileRows(rows as DeckRowRecord[]);

  const referencesById = new Map(snapshot.referenceStyles.map((ref) => [ref.id, ref]));
  const compiledSlides = compiled.compiledSlides.map((slide) => {
    const sourceRow = snapshot.slideRows.find((row) => Number(row.slide_number) === slide.slideNumber && (!targetVersionId || row.versionIds.includes(targetVersionId)));
    const linkedReferences = (sourceRow?.referenceStyleIds || []).map((id: string) => referencesById.get(id)).filter(Boolean);
    return {
      ...slide,
      linkedReferences,
    };
  });

  return {
    ...compiled,
    versionId: targetVersionId,
    compiledSlides,
  };
}

export async function getGeneratedPresentation(versionId?: string) {
  if (!AIRTABLE_TOKEN) throw new Error('Airtable token not configured on the server.');

  const snapshot = await getAirtableSnapshot();
  const targetVersionId = versionId || snapshot.versions[0]?.id;
  if (!targetVersionId) {
    return {
      versionId: '',
      runCount: 0,
      generatedCount: 0,
      generatedSlides: [],
    };
  }

  const [generatedSlides, renderRuns] = await Promise.all([
    listAll('Generated Slides'),
    listAll('Render Runs'),
  ]);

  const filteredRenderRuns = renderRuns.filter((record) => (record.fields['Deck Version'] || []).includes(targetVersionId));
  const filteredSlides = generatedSlides
    .filter((record) => (record.fields['Deck Version'] || []).includes(targetVersionId))
    .map((record) => {
      const rawName = record.fields['Generated Slide Name'] || 'Generated Slide';
      const slideRowId = (record.fields['Slide Row'] || [])[0];
      const matchedRow = snapshot.slideRows.find((row) => row.id === slideRowId);
      const slideNumber = Number(matchedRow?.slide_number || String(rawName).match(/Slide\s+(\d+)/i)?.[1] || 0);
      return {
        id: record.id,
        name: rawName,
        status: record.fields.Status || '',
        promptSummary: record.fields['Prompt Summary'] || '',
        layoutJson: record.fields['Layout JSON'] || '',
        notes: record.fields.Notes || '',
        model: record.fields.Model || '',
        previewImageUrl: record.fields['Preview Image']?.[0]?.url || '',
        deckVersionIds: record.fields['Deck Version'] || [],
        slideRowIds: record.fields['Slide Row'] || [],
        renderRunIds: record.fields['Render Run'] || [],
        iterationNumber: Number(record.fields['Iteration Number'] || 1),
        createdTime: record.fields['Created Time'] || '',
        slideNumber,
      };
    })
    .sort((a, b) => a.slideNumber - b.slideNumber || a.name.localeCompare(b.name));

  return {
    versionId: targetVersionId,
    runCount: filteredRenderRuns.length,
    generatedCount: filteredSlides.length,
    generatedSlides: filteredSlides,
  };
}

export async function getGeneratedSlideById(generatedSlideId: string) {
  if (!AIRTABLE_TOKEN) throw new Error('Airtable token not configured on the server.');

  const records = await listAll('Generated Slides');
  const record = records.find((item) => item.id === generatedSlideId);
  if (!record) throw new Error('Generated slide not found.');

  return {
    id: record.id,
    name: record.fields['Generated Slide Name'] || 'Generated Slide',
    status: record.fields.Status || '',
    promptSummary: record.fields['Prompt Summary'] || '',
    layoutJson: record.fields['Layout JSON'] || '',
    notes: record.fields.Notes || '',
    model: record.fields.Model || '',
    previewImageUrl: record.fields['Preview Image']?.[0]?.url || '',
    deckVersionIds: record.fields['Deck Version'] || [],
    slideRowIds: record.fields['Slide Row'] || [],
    renderRunIds: record.fields['Render Run'] || [],
    iterationNumber: Number(record.fields['Iteration Number'] || 1),
  };
}
