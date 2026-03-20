import { getGeneratedPresentation, getGeneratedSlideById } from './airtable';
import { patchRecords, uploadAttachmentToGenerated } from './generate';
import { generateImageViaOpenRouter } from './lib/openrouterImage';
import { buildSlideEditPrompt } from './lib/editPromptBuilder';

const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';

export type GlobalEditProgress = {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  currentSlideNumber?: number;
};

export type GlobalEditResult = {
  total: number;
  completed: number;
  failed: number;
  results: Array<{
    slideId: string;
    slideNumber: number;
    status: 'success' | 'failed';
    error?: string;
  }>;
};

/**
 * Apply a single edit prompt to all slides in a deck version.
 * Processes slides sequentially to avoid rate limiting.
 */
export async function applyGlobalEdit(
  versionId: string,
  editPrompt: string,
  referenceImageUrls: string[] = [],
  progressCallback?: (progress: GlobalEditProgress) => void
): Promise<GlobalEditResult> {
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
      progressCallback({
        total,
        completed,
        failed,
        current: slide.name,
        currentSlideNumber: slide.slideNumber,
      });
    }

    try {
      const prompt = buildSlideEditPrompt({
        currentName: slide.name,
        slideNumber: slide.slideNumber,
        prompt: editPrompt,
        hasReferenceImages: referenceImageUrls.length > 0,
      });

      const references = [
        ...referenceImageUrls.map((url) => ({ url, caption: 'Reference image for global edit' })),
        { url: slide.previewImageUrl, caption: 'Current slide to edit' },
      ];

      const result = await generateImageViaOpenRouter({
        model: OPENROUTER_IMAGE_MODEL,
        prompt,
        aspectRatio: '16:9',
        references,
      });

      // Clear existing preview
      await patchRecords('Generated Slides', [{
        id: slide.id,
        fields: {
          'Preview Image': [],
        },
      }]);

      // Upload new preview
      await uploadAttachmentToGenerated(slide.id, 'Preview Image', result.filePath, result.fileName, result.contentType);

      // Update status
      await patchRecords('Generated Slides', [{
        id: slide.id,
        fields: {
          Status: 'Succeeded',
          Notes: `Global edit applied: "${editPrompt.slice(0, 100)}${editPrompt.length > 100 ? '...' : ''}"`,
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

    // Rate limit protection: 2 second delay between slides
    if (completed + failed < total) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
