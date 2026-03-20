import { getGeneratedPresentation, getGeneratedSlideById } from './airtable';
import { patchRecords, uploadAttachmentToGenerated } from './generate';
import { generateImageViaOpenRouter } from './lib/openrouterImage';
import { buildSlideEditPrompt } from './lib/editPromptBuilder';

const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';
const GENERATION_ENGINE = process.env.DECK_DIRECTOR_GENERATION_ENGINE || 'nano-banana-2';

export type BulkRegenerateProgress = {
  total: number;
  completed: number;
  failed: number;
  current?: string;
};

export async function bulkRegenerateSlides(
  versionId: string,
  referenceImageUrls: string[],
  progressCallback?: (progress: BulkRegenerateProgress) => void
) {
  const presentation = await getGeneratedPresentation(versionId);
  if (!presentation.generatedSlides.length) {
    throw new Error('No slides found for this version.');
  }

  const total = presentation.generatedSlides.length;
  let completed = 0;
  let failed = 0;

  const results: Array<{ slideId: string; slideNumber: number; status: 'success' | 'failed'; error?: string }> = [];

  for (const slide of presentation.generatedSlides) {
    if (progressCallback) {
      progressCallback({ total, completed, failed, current: slide.name });
    }

    try {
      const prompt = buildBulkRegeneratePrompt(slide.name, slide.slideNumber);

      const references = [
        ...referenceImageUrls.map((url) => ({ url, caption: 'Style reference slide' })),
        { url: slide.previewImageUrl, caption: 'Current slide to redesign' },
      ];

      const result = await generateImageViaOpenRouter({
        model: OPENROUTER_IMAGE_MODEL,
        prompt,
        aspectRatio: '16:9',
        references,
      });

      await patchRecords('Generated Slides', [{
        id: slide.id,
        fields: {
          'Preview Image': [],
        },
      }]);

      await uploadAttachmentToGenerated(slide.id, 'Preview Image', result.filePath, result.fileName, result.contentType);

      await patchRecords('Generated Slides', [{
        id: slide.id,
        fields: {
          Status: 'Succeeded',
          Notes: `Bulk regenerated via reference-driven redesign. Engine: ${GENERATION_ENGINE}`,
        },
      }]);

      completed++;
      results.push({ slideId: slide.id, slideNumber: slide.slideNumber, status: 'success' });
    } catch (error) {
      failed++;
      results.push({
        slideId: slide.id,
        slideNumber: slide.slideNumber,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (progressCallback) {
    progressCallback({ total, completed, failed });
  }

  return {
    total,
    completed,
    failed,
    results,
  };
}

function buildBulkRegeneratePrompt(slideName: string, slideNumber: number) {
  const lines = [
    'You are redesigning an existing presentation slide for Deck Director using Nano Banana 2.',
    'The user has provided style reference slides that represent the desired visual consistency for the entire deck.',
    'Your job: redesign the current slide to match the visual consistency, typography, composition, and design quality of the reference slides.',
    '',
    'CURRENT SLIDE: ' + slideName,
    'SLIDE NUMBER: ' + slideNumber,
    '',
    'REDESIGN GOALS:',
    '- match the visual DNA of the reference slides',
    '- adopt the same typography system, hierarchy, and spacing',
    '- use the same composition principles and grid logic',
    '- match the color palette and mood',
    '- preserve the slide content and intent from the current slide',
    '- keep the result presentation-native and commercially credible',
    '',
    'REDESIGN RULES:',
    '- do not copy the reference slides literally; absorb their design system',
    '- keep all text and data from the current slide unless it conflicts with clarity',
    '- apply the reference style naturally without forcing elements that fit',
    '- maintain professional polish and presentation readability',
    '- do not add browser UI, app chrome, or mockup framing',
    '',
    'Return the redesigned slide image only.',
  ];
  return lines.join('\n');
}
