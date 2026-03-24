import fs from 'fs';
import path from 'path';

const PREVIEW_DIR = path.join(process.env.LAMBDA_TASK_ROOT ? '/tmp' : process.cwd(), 'generated-previews');

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapText(text: string, maxLen: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxLen) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function svgForSlide(slide: any) {
  const refs = (slide.linkedReferences || []).filter((ref: any) => ref?.imageUrl);
  const bgImage = refs[0]?.imageUrl || '';
  const titleLines = wrapText(slide.title || 'Untitled slide', 28).slice(0, 3);
  const bodyLines = wrapText(slide.body || '', 42).slice(0, 5);
  const bullets = (slide.bullets || []).slice(0, 4);
  const refNames = refs.map((ref: any) => ref.name).join(' · ');

  const titleSvg = titleLines
    .map((line: string, index: number) => `<tspan x="84" dy="${index === 0 ? 0 : 58}">${esc(line)}</tspan>`)
    .join('');

  const bodySvg = bodyLines
    .map((line: string, index: number) => `<tspan x="84" dy="${index === 0 ? 0 : 28}">${esc(line)}</tspan>`)
    .join('');

  const bulletSvg = bullets
    .map((line: string, index: number) => `<text x="92" y="${430 + index * 34}" font-size="22" fill="#dbeafe">• ${esc(line)}</text>`)
    .join('');

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#111827" />
      </linearGradient>
      <linearGradient id="overlay" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(15,23,42,0.96)" />
        <stop offset="60%" stop-color="rgba(15,23,42,0.82)" />
        <stop offset="100%" stop-color="rgba(15,23,42,0.38)" />
      </linearGradient>
      <clipPath id="imgClip">
        <rect x="920" y="0" width="680" height="900" rx="0" ry="0" />
      </clipPath>
    </defs>

    <rect width="1600" height="900" fill="url(#bg)"/>
    ${bgImage ? `<image href="${esc(bgImage)}" x="860" y="0" width="740" height="900" preserveAspectRatio="xMidYMid slice" clip-path="url(#imgClip)" />` : ''}
    <rect width="1600" height="900" fill="url(#overlay)"/>
    <rect x="72" y="72" width="1456" height="756" rx="28" ry="28" fill="none" stroke="rgba(147,197,253,0.16)"/>
    <text x="84" y="116" font-family="Arial, Helvetica, sans-serif" font-size="20" letter-spacing="4" fill="#93c5fd">${esc((slide.section || 'Deck Director').toUpperCase())}</text>
    <text x="84" y="198" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="54" fill="#f8fafc">${titleSvg}</text>
    ${slide.subtitle ? `<text x="84" y="380" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#e2e8f0">${esc(slide.subtitle)}</text>` : ''}
    ${slide.body ? `<text x="84" y="${slide.subtitle ? 430 : 360}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#cbd5e1">${bodySvg}</text>` : ''}
    ${bulletSvg}
    <rect x="84" y="732" width="360" height="88" rx="18" ry="18" fill="rgba(30,41,59,0.92)" stroke="rgba(148,163,184,0.18)" />
    <text x="108" y="768" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#93c5fd">TEMPLATE</text>
    <text x="108" y="798" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#f8fafc">${esc(slide.targetTemplate)}</text>
    <text x="1480" y="790" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#cbd5e1">Slide ${slide.slideNumber}</text>
    <text x="1480" y="820" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#94a3b8">${esc(refNames || 'No linked reference')}</text>
  </svg>`;
}

export async function renderSlidePreview(slide: any) {
  await fs.promises.mkdir(PREVIEW_DIR, { recursive: true });
  const fileName = `slide-${String(slide.slideNumber).padStart(2, '0')}.svg`;
  const filePath = path.join(PREVIEW_DIR, fileName);
  await fs.promises.writeFile(filePath, svgForSlide(slide), 'utf8');
  return { filePath, fileName, contentType: 'image/svg+xml' };
}
