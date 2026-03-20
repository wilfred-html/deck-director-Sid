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
