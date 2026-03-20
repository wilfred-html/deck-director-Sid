import { getGeneratedSlideById } from './airtable';
import { patchRecords, uploadAttachmentToGenerated } from './generate';
import { generateImageViaOpenRouter } from './lib/openrouterImage';
import { buildSlideEditPrompt } from './lib/editPromptBuilder';

const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';
const GENERATION_ENGINE = process.env.DECK_DIRECTOR_GENERATION_ENGINE || 'nano-banana-2';

export async function createEditedSlideVariant(generatedSlideId: string, prompt: string, referenceImageUrls?: string[]) {
  const slide = await getGeneratedSlideById(generatedSlideId);
  if (!slide.previewImageUrl) throw new Error('Current slide has no preview image to edit.');

  const match = slide.name.match(/Slide\s+(\d+)/i);
  const slideNumber = Number(match?.[1] || 0);

  const editPrompt = buildSlideEditPrompt({
    currentName: slide.name,
    slideNumber,
    prompt,
    promptSummary: slide.promptSummary,
    notes: slide.notes,
    hasReferenceImages: (referenceImageUrls?.length || 0) > 0,
  });

  const references = [
    { url: slide.previewImageUrl, caption: 'Current slide to edit' },
    ...(referenceImageUrls || []).map((url) => ({ url, caption: 'User-provided reference image' })),
  ];

  const result = await generateImageViaOpenRouter({
    model: OPENROUTER_IMAGE_MODEL,
    prompt: editPrompt,
    aspectRatio: '16:9',
    references,
  });

  return {
    generatedSlideId,
    model: OPENROUTER_IMAGE_MODEL,
    engine: GENERATION_ENGINE,
    prompt,
    variantImageUrl: result.dataUrl,
    tempFilePath: result.filePath,
    tempFileName: result.fileName,
    contentType: result.contentType,
  };
}

export async function applyEditedSlideVariant(args: {
  generatedSlideId: string;
  prompt: string;
  tempFilePath: string;
  tempFileName: string;
  contentType: string;
}) {
  await patchRecords('Generated Slides', [{
    id: args.generatedSlideId,
    fields: {
      'Preview Image': [],
      Notes: `Edited via Deck Director chat assist. Engine: ${GENERATION_ENGINE}\nEdit request: ${args.prompt}`,
    },
  }]);

  await uploadAttachmentToGenerated(args.generatedSlideId, 'Preview Image', args.tempFilePath, args.tempFileName, args.contentType);

  return {
    ok: true,
    generatedSlideId: args.generatedSlideId,
  };
}
