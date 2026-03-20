export type GenerationSlide = {
  slideNumber: number;
  section: string;
  intent: string;
  targetTemplate: string;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  visualBrief?: string;
  mediaType?: string;
  emphasis?: string;
  rollingContext?: Array<{ slide_number: string; title: string; section: string; intent: string; layout_type: string }>;
  linkedReferences?: Array<{ id: string; name: string; role: string; mediaWorld: string; styleNotes: string; keywords: string; imageUrl: string }>;
};

export function buildPromptPackage(slide: GenerationSlide) {
  const referenceSummary = (slide.linkedReferences || []).map((reference) => ({
    name: reference.name,
    role: reference.role,
    mediaWorld: reference.mediaWorld,
    styleNotes: reference.styleNotes,
    keywords: reference.keywords,
    imageUrl: reference.imageUrl,
  }));

  return {
    mission: 'Generate a finished premium presentation slide visual, not a wireframe, not HTML, not SVG, not a UI mockup.',
    modelIntent: 'Nano Banana 2 should produce presentation-grade slide artwork that already feels client-facing.',
    slide: {
      number: slide.slideNumber,
      section: slide.section,
      intent: slide.intent,
      template: slide.targetTemplate,
      title: slide.title,
      subtitle: slide.subtitle || '',
      body: slide.body || '',
      bullets: slide.bullets || [],
      visualBrief: slide.visualBrief || '',
      mediaType: slide.mediaType || 'unknown',
      emphasis: slide.emphasis || 'balanced',
    },
    deckSystem: {
      concept: 'Premium strategic deck with editorial confidence, cinematic restraint, asymmetrical composition, and strong narrative pacing.',
      composition: 'Use presentation composition, not poster chaos. Respect margins, alignment, hierarchy, and slide readability.',
      typography: 'Big decisive headline, disciplined secondary hierarchy, compact supporting copy. Avoid tiny unreadable text walls.',
      color: 'Restrained, premium palette. Confident contrast. Avoid childish saturation unless the references clearly demand it.',
      behavior: 'This must look like a designed keynote/pitch slide, ready for review by strategy and creative leadership.',
    },
    continuity: {
      rollingContext: slide.rollingContext || [],
      note: 'Use the current row and the previous two rows only for local narrative continuity. Keep the global deck system consistent across the whole deck.',
    },
    references: referenceSummary,
    hardRules: [
      'Do not render browser UI, app chrome, or webpage framing.',
      'Do not produce raw text dumps or document pages.',
      'Do not make it look like an infographic unless the template explicitly suggests it.',
      'Do not imitate the reference images literally; absorb their tone, composition discipline, and trust level.',
      'Make the slide feel presentation-native and commercially credible.',
      'If there is text on slide, keep it deliberate, minimal, and legible.',
      'Prioritize design quality over decorative excess.',
    ],
  };
}

export function buildGenerationPrompt(slide: GenerationSlide) {
  const promptPackage = buildPromptPackage(slide);

  return [
    'You are generating a finished presentation slide visual for Deck Director using Nano Banana 2.',
    'This is an AI-native slide generation workflow. Do not output code, SVG, HTML, UI screenshots, or wireframes.',
    'Generate a polished 16:9 presentation slide image that looks ready for an internal strategy/client review.',
    '',
    `SLIDE NUMBER: ${slide.slideNumber}`,
    `SECTION: ${slide.section}`,
    `INTENT: ${slide.intent}`,
    `TARGET TEMPLATE: ${slide.targetTemplate}`,
    `TITLE: ${slide.title}`,
    slide.subtitle ? `SUBTITLE: ${slide.subtitle}` : '',
    slide.body ? `BODY: ${slide.body}` : '',
    slide.bullets?.length ? `BULLETS: ${slide.bullets.join(' | ')}` : '',
    slide.visualBrief ? `VISUAL BRIEF: ${slide.visualBrief}` : '',
    `MEDIA TYPE: ${slide.mediaType || 'unknown'}`,
    `EMPHASIS: ${slide.emphasis || 'balanced'}`,
    '',
    'GLOBAL DECK SYSTEM:',
    '- premium editorial tone',
    '- cinematic restraint',
    '- asymmetrical composition',
    '- strong strategic hierarchy',
    '- presentation-first readability',
    '- avoid HTML/SVG/mockup feel completely',
    '',
    'ROLLING CONTEXT:',
    ...(slide.rollingContext || []).map((item) => `- slide ${item.slide_number}: ${item.title} / ${item.section} / ${item.intent} / ${item.layout_type}`),
    '',
    'REFERENCE STYLE DNA:',
    ...((slide.linkedReferences || []).length
      ? (slide.linkedReferences || []).map((reference) => `- ${reference.name}: ${reference.role}; ${reference.mediaWorld}; ${reference.styleNotes}; keywords: ${reference.keywords}`)
      : ['- no linked references supplied; keep the deck premium, strategic, and presentation-native']),
    '',
    'QUALITY BAR:',
    '- looks like a serious agency/strategy deck slide',
    '- elegant layout decisions',
    '- believable use of imagery',
    '- restrained but confident typography',
    '- no placeholder energy',
    '- no generic app-dashboard aesthetics',
    '',
    'Return the actual slide image only.',
    '',
    'PROMPT PACKAGE JSON:',
    JSON.stringify(promptPackage, null, 2),
  ].filter(Boolean).join('\n');
}
