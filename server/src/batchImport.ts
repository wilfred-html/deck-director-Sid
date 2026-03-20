import fs from 'fs';
import path from 'path';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appb1sdK2880A8HYT';
const AIRTABLE_TOKEN = process.env.AIRTABLE_ACCESS_TOKEN || process.env.AIRTABLE_TOKEN || '';

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

async function uploadAttachmentToRecord(recordId: string, tableName: string, fieldName: string, filePath: string, filename: string, contentType: string) {
  const file = await fs.promises.readFile(filePath);
  const payload = {
    contentType,
    filename,
    file: file.toString('base64'),
  };

  const response = await fetch(`https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${recordId}/${fieldName}/uploadAttachment`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Failed to upload attachment to Airtable: ${response.status}`);
  return response.json();
}

export type BatchImportSlide = {
  slideNumber: number;
  imagePath: string;
  contentType: string;
};

export type BatchImportResult = {
  versionId: string;
  importedCount: number;
  slideIds: string[];
};

/**
 * Batch import slide images into Airtable as Generated Slides.
 * Creates a new deck version and links all slides to it.
 */
export async function batchImportSlides(
  deckName: string,
  versionName: string,
  slides: BatchImportSlide[],
  deckId?: string
): Promise<BatchImportResult> {
  if (!AIRTABLE_TOKEN) throw new Error('Airtable token not configured on server.');

  // Create version
  const version = await createRecord('Deck Versions', {
    'Version Name': versionName,
    'Version Number': versionName,
    Status: 'Ready',
    'Compiler Mode': 'imported',
    ...(deckId ? { Deck: [deckId] } : {}),
  });

  const slideIds: string[] = [];

  for (const slide of slides) {
    const fileName = path.basename(slide.imagePath);
    
    const generatedSlide = await createRecord('Generated Slides', {
      'Generated Slide Name': `${deckName} / Slide ${slide.slideNumber}`,
      Status: 'Succeeded',
      'Prompt Summary': 'Imported from batch upload',
      Model: 'imported',
      'Iteration Number': 1,
      Notes: `Batch imported from ${fileName}`,
      'Deck Version': [version.id],
    });

    await uploadAttachmentToRecord(
      generatedSlide.id,
      'Generated Slides',
      'Preview Image',
      slide.imagePath,
      fileName,
      slide.contentType
    );

    slideIds.push(generatedSlide.id);
  }

  return {
    versionId: version.id,
    importedCount: slideIds.length,
    slideIds,
  };
}
