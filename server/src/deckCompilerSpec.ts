export type RowIntent =
  | 'cover'
  | 'divider'
  | 'narrative'
  | 'framework'
  | 'timeline'
  | 'comparison'
  | 'evidence'
  | 'quote'
  | 'summary';

export type LayoutType =
  | 'hero'
  | 'divider-left'
  | 'text-image-7-5'
  | 'text-image-5-7'
  | 'framework-3-card'
  | 'framework-4-card'
  | 'timeline-horizontal'
  | 'comparison-split'
  | 'quote-impact'
  | 'summary-grid';

export interface DeckRowSchemaField {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example?: string;
}

export interface RollingWindowRule {
  strategy: 'rolling-neighbors';
  currentRow: 'always';
  lookbackRows: number;
  examples: string[];
  note: string;
}

export const deckRowSchema: DeckRowSchemaField[] = [
  { key: 'slide_number', label: 'Slide Number', required: true, description: 'Absolute slide number in the deck.', example: '12' },
  { key: 'section', label: 'Section', required: true, description: 'Narrative chapter or section this row belongs to.', example: 'Activation Ecosystem' },
  { key: 'intent', label: 'Intent', required: true, description: 'What this slide is trying to do.', example: 'framework' },
  { key: 'layout_type', label: 'Layout Type', required: true, description: 'Preferred display logic for this row.', example: 'timeline-horizontal' },
  { key: 'title', label: 'Title', required: true, description: 'Primary headline for the slide.', example: 'How the campaign unfolds' },
  { key: 'subtitle', label: 'Subtitle', required: false, description: 'Optional secondary line supporting the title.' },
  { key: 'body', label: 'Body', required: false, description: 'Short supporting copy, not full speaker notes.' },
  { key: 'bullets', label: 'Bullets', required: false, description: 'Pipe-separated or newline-separated bullets.', example: 'Hook | Agitation | Pivot | CTA' },
  { key: 'visual_brief', label: 'Visual Brief', required: false, description: 'What image or visual language should appear on the slide.' },
  { key: 'media_type', label: 'Media Type', required: false, description: 'real | ai | screenshot | chart | none', example: 'real' },
  { key: 'chart_type', label: 'Chart Type', required: false, description: 'Optional chart or diagram requirement.', example: 'timeline' },
  { key: 'speaker_notes', label: 'Speaker Notes', required: false, description: 'Longer explanation that should not all appear on slide.' },
  { key: 'must_keep', label: 'Must Keep', required: false, description: 'Specific claims, figures, or brand elements that cannot be dropped.' },
  { key: 'emphasis', label: 'Emphasis', required: false, description: 'text-led | image-led | balanced', example: 'balanced' },
  { key: 'reference_image_ids', label: 'Reference Image IDs', required: false, description: 'Comma-separated ids of reference visuals to borrow tone from.' },
  { key: 'design_notes', label: 'Design Notes', required: false, description: 'Per-row instructions that override defaults sparingly.' },
];

export const rollingWindowRule: RollingWindowRule = {
  strategy: 'rolling-neighbors',
  currentRow: 'always',
  lookbackRows: 2,
  examples: [
    'row 1 -> row 1 only',
    'row 2 -> rows 1-2',
    'row 3 -> rows 1-2-3',
    'row 4 -> rows 2-3-4',
    'row 5 -> rows 3-4-5',
  ],
  note: 'Use global deck style as fixed memory; use only the previous two rows for local narrative continuity.',
};

export const compilerStages = [
  {
    name: 'Normalize rows',
    description: 'Validate spreadsheet rows against the deck row schema and coerce them into typed slide records.',
  },
  {
    name: 'Lock deck system',
    description: 'Build one global design system from reference images, brand tokens, and approved templates.',
  },
  {
    name: 'Plan each row',
    description: 'Map each row to a template and produce a structured slide plan.',
  },
  {
    name: 'Generate with rolling context',
    description: 'Render each row using current row + previous two rows + fixed global deck memory.',
  },
  {
    name: 'Consistency pass',
    description: 'Normalize footer, typography, image treatment, and pacing across the full deck after generation.',
  },
];
