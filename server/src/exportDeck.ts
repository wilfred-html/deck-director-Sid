import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import PptxGenJS from 'pptxgenjs';
import { getGeneratedPresentation } from './airtable';

const EXPORT_DIR = process.env.LAMBDA_TASK_ROOT ? '/tmp/exports' : path.join(process.cwd(), 'exports');

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    return {
      base64: buffer.toString('base64'),
      mimeType: contentType,
    };
  } catch {
    return null;
  }
}

function mimeToExtension(mimeType: string): string {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpeg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'png'; // pptxgenjs doesn't support webp, treat as png
  return 'png';
}

export async function exportAsPptx(versionId: string): Promise<{ filePath: string; fileName: string }> {
  const presentation = await getGeneratedPresentation(versionId);
  if (!presentation.generatedSlides.length) {
    throw new Error('No generated slides found. Generate slides first before exporting.');
  }

  await fs.promises.mkdir(EXPORT_DIR, { recursive: true });

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 16:9

  for (const slide of presentation.generatedSlides) {
    if (!slide.previewImageUrl) continue;

    const imageData = await fetchImageAsBase64(slide.previewImageUrl);
    const pptxSlide = pptx.addSlide();

    if (imageData) {
      const ext = mimeToExtension(imageData.mimeType);
      pptxSlide.addImage({
        data: `image/${ext};base64,${imageData.base64}`,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
        sizing: { type: 'cover', w: '100%', h: '100%' },
      });
    } else {
      // Fallback: slide with title text
      pptxSlide.addText(slide.name || `Slide ${slide.slideNumber}`, {
        x: 1,
        y: 2,
        w: 11,
        h: 2,
        fontSize: 36,
        color: 'FFFFFF',
        bold: true,
        align: 'center',
      });
      pptxSlide.background = { color: '1A3C3C' };
    }
  }

  const fileName = `deck-${versionId.slice(-6)}-${Date.now()}.pptx`;
  const filePath = path.join(EXPORT_DIR, fileName);
  await pptx.writeFile({ fileName: filePath });

  return { filePath, fileName };
}
