import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import AdmZip from 'adm-zip';

const BASE_DIR = process.env.LAMBDA_TASK_ROOT ? '/tmp' : process.cwd();
const PPTX_STAGING_DIR = path.join(BASE_DIR, 'pptx-staging');
const PPTX_EXTRACTS_DIR = path.join(BASE_DIR, 'pptx-extracts');

export type PPTXSlideExtract = {
  slideNumber: number;
  imagePath: string;
  extractedText?: string;
};

export type PPTXExtractionResult = {
  deckName: string;
  slideCount: number;
  slides: PPTXSlideExtract[];
  pptxPath: string;
};

/**
 * Get slide count from a PPTX file by inspecting presentation.xml
 */
async function getPPTXSlideCount(pptxPath: string): Promise<number> {
  try {
    const zip = new AdmZip(pptxPath);
    const presentationEntry = zip.getEntry('ppt/presentation.xml');
    if (!presentationEntry) return 0;

    const content = presentationEntry.getData().toString('utf8');
    const slideMatches = content.match(/<p:sldId /g);
    return slideMatches ? slideMatches.length : 0;
  } catch (error) {
    console.error('Failed to read PPTX slide count:', error);
    return 0;
  }
}

/**
 * Accept PPTX file and prepare it for manual image extraction.
 * Returns structure ready for bulk import.
 * 
 * User workflow:
 * 1. Upload PPTX
 * 2. System detects slide count
 * 3. User manually exports slides as images from PowerPoint/Keynote/Google Slides
 * 4. User uploads extracted images via batch upload endpoint
 * 5. System matches images to slide numbers and creates deck version
 */
export async function preparePPTXForExtraction(pptxFilePath: string): Promise<PPTXExtractionResult> {
  await fs.promises.mkdir(PPTX_STAGING_DIR, { recursive: true });
  await fs.promises.mkdir(PPTX_EXTRACTS_DIR, { recursive: true });

  const deckName = path.basename(pptxFilePath, path.extname(pptxFilePath));
  const slideCount = await getPPTXSlideCount(pptxFilePath);

  const targetPath = path.join(PPTX_STAGING_DIR, path.basename(pptxFilePath));
  await fs.promises.copyFile(pptxFilePath, targetPath);

  const slides: PPTXSlideExtract[] = Array.from({ length: slideCount }, (_, i) => ({
    slideNumber: i + 1,
    imagePath: path.join(PPTX_EXTRACTS_DIR, `${deckName}-slide-${String(i + 1).padStart(3, '0')}.png`),
  }));

  return {
    deckName,
    slideCount,
    slides,
    pptxPath: targetPath,
  };
}

/**
 * Alternative: auto-extract using PDF intermediate if libreoffice is available
 */
export async function extractSlidesViaPDF(pptxFilePath: string): Promise<PPTXExtractionResult> {
  await fs.promises.mkdir(PPTX_STAGING_DIR, { recursive: true });
  await fs.promises.mkdir(PPTX_EXTRACTS_DIR, { recursive: true });

  const deckName = path.basename(pptxFilePath, path.extname(pptxFilePath));

  // Step 1: PPTX → PDF
  const pdfPath = await convertPPTXtoPDF(pptxFilePath, PPTX_STAGING_DIR);

  // Step 2: PDF → images
  const outputPrefix = path.join(PPTX_EXTRACTS_DIR, deckName);
  const imagePathsRaw = await convertPDFtoImages(pdfPath, outputPrefix);

  const slides: PPTXSlideExtract[] = imagePathsRaw.map((imagePath, index) => ({
    slideNumber: index + 1,
    imagePath,
  }));

  return {
    deckName,
    slideCount: slides.length,
    slides,
    pptxPath: pptxFilePath,
  };
}

/**
 * Convert PPTX → PDF using LibreOffice headless mode.
 */
async function convertPPTXtoPDF(pptxPath: string, outputDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('libreoffice', [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      outputDir,
      pptxPath,
    ]);

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`LibreOffice conversion failed (not installed or error): ${stderr}`));
      }
      const pdfPath = path.join(outputDir, path.basename(pptxPath, '.pptx') + '.pdf');
      resolve(pdfPath);
    });
  });
}

/**
 * Convert PDF → PNG images using pdftoppm.
 */
async function convertPDFtoImages(pdfPath: string, outputPrefix: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('pdftoppm', [
      '-png',
      '-r',
      '150',
      pdfPath,
      outputPrefix,
    ]);

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        return reject(new Error(`pdftoppm conversion failed: ${stderr}`));
      }

      const dir = path.dirname(outputPrefix);
      const base = path.basename(outputPrefix);
      const files = await fs.promises.readdir(dir);
      const images = files
        .filter((f) => f.startsWith(base) && f.endsWith('.png'))
        .map((f) => path.join(dir, f))
        .sort();

      resolve(images);
    });
  });
}
