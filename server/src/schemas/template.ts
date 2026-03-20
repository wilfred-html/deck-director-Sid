import type { MediaSourceType, SlideIntent } from './slide';

export type TemplateId =
  | 'hero'
  | 'divider-left'
  | 'text-image-7-5'
  | 'text-image-5-7'
  | 'quote-impact'
  | 'framework-3-card'
  | 'framework-4-card'
  | 'timeline-horizontal'
  | 'summary-grid';

export interface TemplateRegion {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  optional?: boolean;
}

export interface TemplateConstraints {
  maxWords: number;
  maxBullets?: number;
  titleLinesMax: number;
  allowedMedia: MediaSourceType[];
}

export interface SlideTemplate {
  id: TemplateId;
  label: string;
  intents: SlideIntent[];
  regions: TemplateRegion[];
  constraints: TemplateConstraints;
}

export const templateLibrary: SlideTemplate[] = [
  {
    id: 'hero',
    label: 'Hero / Opening',
    intents: ['hero'],
    regions: [
      { name: 'title', x: 72, y: 72, w: 620, h: 120 },
      { name: 'subtitle', x: 72, y: 206, w: 520, h: 120, optional: true },
      { name: 'hero-image', x: 760, y: 0, w: 680, h: 720 },
      { name: 'footer', x: 72, y: 742, w: 1296, h: 36 },
    ],
    constraints: {
      maxWords: 32,
      titleLinesMax: 2,
      allowedMedia: ['real-photography', 'ai-generated', 'screenshot'],
    },
  },
  {
    id: 'divider-left',
    label: 'Section Divider',
    intents: ['divider'],
    regions: [
      { name: 'eyebrow', x: 72, y: 90, w: 320, h: 26 },
      { name: 'title', x: 72, y: 148, w: 720, h: 120 },
      { name: 'subtitle', x: 72, y: 288, w: 560, h: 80, optional: true },
      { name: 'footer', x: 72, y: 742, w: 1296, h: 36 },
    ],
    constraints: {
      maxWords: 20,
      titleLinesMax: 2,
      allowedMedia: ['unknown'],
    },
  },
  {
    id: 'text-image-7-5',
    label: 'Text + Image (7/5)',
    intents: ['explain', 'comparison'],
    regions: [
      { name: 'title', x: 72, y: 56, w: 620, h: 80 },
      { name: 'body', x: 72, y: 160, w: 560, h: 360 },
      { name: 'supporting-image', x: 760, y: 132, w: 560, h: 430 },
      { name: 'footer', x: 72, y: 742, w: 1296, h: 36 },
    ],
    constraints: {
      maxWords: 58,
      maxBullets: 5,
      titleLinesMax: 2,
      allowedMedia: ['real-photography', 'ai-generated', 'screenshot'],
    },
  },
  {
    id: 'text-image-5-7',
    label: 'Text + Image (5/7)',
    intents: ['explain'],
    regions: [
      { name: 'title', x: 72, y: 56, w: 520, h: 80 },
      { name: 'body', x: 72, y: 160, w: 460, h: 360 },
      { name: 'supporting-image', x: 640, y: 120, w: 700, h: 460 },
      { name: 'footer', x: 72, y: 742, w: 1296, h: 36 },
    ],
    constraints: {
      maxWords: 52,
      maxBullets: 4,
      titleLinesMax: 2,
      allowedMedia: ['real-photography', 'ai-generated', 'screenshot'],
    },
  },
  {
    id: 'quote-impact',
    label: 'Impact Quote',
    intents: ['quote'],
    regions: [
      { name: 'quote', x: 120, y: 150, w: 1080, h: 220 },
      { name: 'caption', x: 120, y: 396, w: 420, h: 60, optional: true },
      { name: 'footer', x: 72, y: 742, w: 1296, h: 36 },
    ],
    constraints: {
      maxWords: 28,
      titleLinesMax: 4,
      allowedMedia: ['unknown'],
    },
  },
  {
    id: 'framework-3-card',
    label: 'Three-card Framework',
    intents: ['framework', 'data-story'],
    regions: [
      { name: 'title', x: 72, y: 56, w: 760, h: 80 },
      { name: 'card-1', x: 72, y: 188, w: 400, h: 320 },
      { name: 'card-2', x: 520, y: 188, w: 400, h: 320 },
      { name: 'card-3', x: 968, y: 188, w: 400, h: 320 },
      { name: 'footer', x: 72, y: 742, w: 1296, h: 36 },
    ],
    constraints: {
      maxWords: 72,
      maxBullets: 6,
      titleLinesMax: 2,
      allowedMedia: ['real-photography', 'ai-generated', 'chart-dataviz', 'icon-graphic', 'screenshot'],
    },
  },
  {
    id: 'framework-4-card',
    label: 'Four-card Concept Grid',
    intents: ['framework', 'comparison'],
    regions: [
      { name: 'title', x: 72, y: 56, w: 760, h: 80 },
      { name: 'card-grid', x: 72, y: 176, w: 1296, h: 460 },
      { name: 'footer', x: 72, y: 742, w: 1296, h: 36 },
    ],
    constraints: {
      maxWords: 88,
      maxBullets: 8,
      titleLinesMax: 2,
      allowedMedia: ['real-photography', 'ai-generated', 'icon-graphic', 'screenshot'],
    },
  },
  {
    id: 'timeline-horizontal',
    label: 'Horizontal Timeline',
    intents: ['timeline', 'framework'],
    regions: [
      { name: 'title', x: 72, y: 56, w: 760, h: 80 },
      { name: 'timeline', x: 72, y: 220, w: 1296, h: 300 },
      { name: 'footer', x: 72, y: 742, w: 1296, h: 36 },
    ],
    constraints: {
      maxWords: 70,
      maxBullets: 5,
      titleLinesMax: 2,
      allowedMedia: ['icon-graphic', 'chart-dataviz', 'screenshot', 'unknown'],
    },
  },
  {
    id: 'summary-grid',
    label: 'Summary Grid',
    intents: ['summary', 'data-story'],
    regions: [
      { name: 'title', x: 72, y: 56, w: 760, h: 80 },
      { name: 'summary-grid', x: 72, y: 176, w: 1296, h: 420 },
      { name: 'footer', x: 72, y: 742, w: 1296, h: 36 },
    ],
    constraints: {
      maxWords: 80,
      maxBullets: 8,
      titleLinesMax: 2,
      allowedMedia: ['chart-dataviz', 'icon-graphic', 'screenshot', 'real-photography', 'ai-generated'],
    },
  },
];
