export type ElementType =
  | 'text'
  | 'image'
  | 'shape'
  | 'chart'
  | 'table'
  | 'logo'
  | 'icon'
  | 'screenshot';

export type ElementRole =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'caption'
  | 'eyebrow'
  | 'hero-image'
  | 'supporting-image'
  | 'background-image'
  | 'footer'
  | 'logo-lockup'
  | 'chart'
  | 'table'
  | 'callout'
  | 'quote'
  | 'stat';

export type MediaSourceType =
  | 'real-photography'
  | 'ai-generated'
  | 'illustration'
  | 'icon-graphic'
  | 'chart-dataviz'
  | 'logo-brandmark'
  | 'screenshot'
  | 'unknown';

export type MediaAction =
  | 'keep'
  | 'retreat'
  | 'recrop'
  | 'replace'
  | 'regenerate'
  | 'demote'
  | 'remove';

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ElementStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  opacity?: number;
  borderRadius?: number;
}

export interface MediaDescriptor {
  sourceType: MediaSourceType;
  styleTags: string[];
  qualityScore: number;
  realismScore: number;
  artifactScore: number;
  consistencyScore: number;
  recommendedAction: MediaAction;
}

export interface SlideElement {
  id: string;
  type: ElementType;
  role: ElementRole;
  content?: string;
  bbox: BBox;
  style?: ElementStyle;
  media?: MediaDescriptor;
}

export type SlideIntent =
  | 'hero'
  | 'divider'
  | 'explain'
  | 'framework'
  | 'comparison'
  | 'timeline'
  | 'quote'
  | 'summary'
  | 'data-story';

export interface SlideModel {
  slideNumber: number;
  intent: SlideIntent;
  rawText: string;
  wordCount: number;
  lineCount: number;
  headingLength: number;
  elements: SlideElement[];
  notes?: string;
}
