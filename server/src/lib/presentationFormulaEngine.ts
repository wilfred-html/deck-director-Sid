import { templateLibrary } from '../schemas/template';

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

export type SlideArchetype =
  | 'cover-hero'
  | 'section-divider'
  | 'narrative-image-led'
  | 'narrative-text-led'
  | 'framework-grid'
  | 'timeline'
  | 'comparison'
  | 'evidence-proof'
  | 'quote-impact'
  | 'summary-close';

export type CompositionFormula = 'rule-of-thirds' | 'phi-split' | 'editorial-grid' | 'centered-monument' | 'timeline-rail';

export interface PresentationFormulaDecision {
  archetype: SlideArchetype;
  assertion: string;
  evidenceType: string;
  compositionFormula: CompositionFormula;
  compositionGuidance: string[];
  hierarchyFormula: string[];
  cognitiveRules: string[];
  densityLimits: {
    maxTitleWords: number;
    maxBodyWords: number;
    maxBullets: number;
    maxVisibleClusters: number;
    maxPrimaryCallouts: number;
  };
  focalIsolate: string;
  pacingRole: 'anchor' | 'release' | 'bridge' | 'proof' | 'escalation' | 'close';
  continuityInstructions: string[];
  warningFlags: string[];
}

function words(value?: string) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length;
}

function deriveAssertion(slide: GenerationSlide) {
  if (slide.title?.trim()) return slide.title.trim();
  if (slide.body?.trim()) return slide.body.trim().split(/[.!?]/)[0].trim();
  return `Slide ${slide.slideNumber} key message`;
}

function detectArchetype(slide: GenerationSlide): SlideArchetype {
  if (slide.intent === 'cover' || slide.targetTemplate === 'hero') return 'cover-hero';
  if (slide.intent === 'divider' || slide.targetTemplate === 'divider-left') return 'section-divider';
  if (slide.intent === 'quote' || slide.targetTemplate === 'quote-impact') return 'quote-impact';
  if (slide.intent === 'timeline' || slide.targetTemplate === 'timeline-horizontal') return 'timeline';
  if (slide.intent === 'comparison' || slide.targetTemplate === 'comparison-split') return 'comparison';
  if (slide.intent === 'evidence') return 'evidence-proof';
  if (slide.intent === 'framework' || slide.targetTemplate.includes('framework')) return 'framework-grid';
  if (slide.intent === 'summary' || slide.targetTemplate === 'summary-grid') return 'summary-close';
  if ((slide.emphasis || '').toLowerCase() === 'image-led') return 'narrative-image-led';
  if ((slide.mediaType || '').toLowerCase() === 'real') return 'narrative-image-led';
  return 'narrative-text-led';
}

function pacingRoleFor(archetype: SlideArchetype, slideNumber: number): PresentationFormulaDecision['pacingRole'] {
  if (slideNumber === 1 || archetype === 'cover-hero') return 'anchor';
  if (archetype === 'section-divider') return 'release';
  if (archetype === 'evidence-proof') return 'proof';
  if (archetype === 'summary-close') return 'close';
  if (archetype === 'framework-grid' || archetype === 'timeline') return 'bridge';
  return 'escalation';
}

function densityDefaults(archetype: SlideArchetype) {
  switch (archetype) {
    case 'cover-hero':
      return { maxTitleWords: 8, maxBodyWords: 18, maxBullets: 0, maxVisibleClusters: 2, maxPrimaryCallouts: 1 };
    case 'section-divider':
      return { maxTitleWords: 6, maxBodyWords: 8, maxBullets: 0, maxVisibleClusters: 1, maxPrimaryCallouts: 0 };
    case 'quote-impact':
      return { maxTitleWords: 16, maxBodyWords: 0, maxBullets: 0, maxVisibleClusters: 1, maxPrimaryCallouts: 1 };
    case 'timeline':
      return { maxTitleWords: 10, maxBodyWords: 24, maxBullets: 5, maxVisibleClusters: 5, maxPrimaryCallouts: 3 };
    case 'framework-grid':
      return { maxTitleWords: 10, maxBodyWords: 28, maxBullets: 4, maxVisibleClusters: 4, maxPrimaryCallouts: 1 };
    case 'comparison':
      return { maxTitleWords: 10, maxBodyWords: 24, maxBullets: 4, maxVisibleClusters: 3, maxPrimaryCallouts: 2 };
    case 'evidence-proof':
      return { maxTitleWords: 12, maxBodyWords: 20, maxBullets: 3, maxVisibleClusters: 3, maxPrimaryCallouts: 3 };
    case 'summary-close':
      return { maxTitleWords: 10, maxBodyWords: 22, maxBullets: 3, maxVisibleClusters: 3, maxPrimaryCallouts: 1 };
    case 'narrative-image-led':
      return { maxTitleWords: 12, maxBodyWords: 26, maxBullets: 4, maxVisibleClusters: 2, maxPrimaryCallouts: 1 };
    case 'narrative-text-led':
    default:
      return { maxTitleWords: 12, maxBodyWords: 32, maxBullets: 4, maxVisibleClusters: 2, maxPrimaryCallouts: 1 };
  }
}

function compositionFor(archetype: SlideArchetype): { formula: CompositionFormula; guidance: string[] } {
  switch (archetype) {
    case 'cover-hero':
      return {
        formula: 'rule-of-thirds',
        guidance: [
          'Place the dominant subject or visual energy near a thirds intersection.',
          'Place the headline mass in the opposing third zone for tension and balance.',
          'Avoid dead-center symmetry unless the mood is ceremonial and intentional.',
        ],
      };
    case 'section-divider':
      return {
        formula: 'centered-monument',
        guidance: [
          'Use monumental simplicity, oversized type, and negative space.',
          'Treat the slide as a pause/reset, not an information container.',
          'Allow atmosphere or texture, but keep one clear focal statement only.',
        ],
      };
    case 'narrative-image-led':
    case 'comparison':
    case 'evidence-proof':
      return {
        formula: 'phi-split',
        guidance: [
          'Use a premium asymmetric split such as 62/38 or 38/62.',
          'Let one side carry the proof or image, and the other side carry the assertion.',
          'Keep composition keynote-native, not poster-chaotic.',
        ],
      };
    case 'timeline':
      return {
        formula: 'timeline-rail',
        guidance: [
          'Build a strong horizontal reading rail with clear stage markers.',
          'Show progression and temporal logic before decorative detail.',
          'Keep event nodes evenly paced and easy to scan left to right.',
        ],
      };
    case 'framework-grid':
    case 'summary-close':
    case 'narrative-text-led':
    default:
      return {
        formula: 'editorial-grid',
        guidance: [
          'Compose on a disciplined editorial grid with obvious grouping.',
          'Use repeated alignment rails and equalized rhythm between content blocks.',
          'Prefer clarity and order over ornamental complexity.',
        ],
      };
  }
}

function evidenceTypeFor(archetype: SlideArchetype, slide: GenerationSlide) {
  switch (archetype) {
    case 'cover-hero': return 'hero image + assertion headline';
    case 'section-divider': return 'section title + atmospheric visual field';
    case 'quote-impact': return 'single memorable statement';
    case 'framework-grid': return 'structured concept cards';
    case 'timeline': return 'sequenced roadmap or process rail';
    case 'comparison': return 'side-by-side contrast';
    case 'evidence-proof': return slide.mediaType === 'chart' ? 'chart/dataviz proof' : 'proof visual + annotated claim';
    case 'summary-close': return '3 distilled takeaways';
    case 'narrative-image-led': return 'documentary or cinematic support image';
    default: return 'supporting visual with short explanatory copy';
  }
}

function hierarchyFor(archetype: SlideArchetype) {
  const common = [
    'Use assertion-evidence structure: one clear claim, one dominant proof/support field, minimal clarifying text.',
    'Treat the headline as the point of the slide, not a topic label.',
    'Keep support text visibly subordinate to the assertion.',
  ];

  switch (archetype) {
    case 'framework-grid':
      return [...common, 'Use equal card rhythm, but allow one card to carry slight emphasis if strategically necessary.'];
    case 'quote-impact':
      return [...common, 'Let the quote dominate; attribution should be quiet and secondary.'];
    case 'evidence-proof':
      return [...common, 'Let the proof object dominate more than the body copy; use 1–3 callouts only.'];
    case 'summary-close':
      return [...common, 'Reduce to 3 takeaways max and one closing implication.'];
    default:
      return common;
  }
}

function cognitiveRulesFor(archetype: SlideArchetype) {
  const rules = [
    'Apply coherence: remove non-essential decorative or textual clutter.',
    'Apply signaling: make the organization of the slide obvious at a glance.',
    'Apply spatial contiguity: keep labels and related visuals close together.',
    'Apply Hick’s Law: do not present more visible options/clusters than needed.',
    'Apply Von Restorff carefully: isolate exactly one memorable thing on the slide.',
  ];

  if (archetype === 'framework-grid' || archetype === 'timeline') {
    rules.push('Apply segmenting: break the idea into discrete blocks or stages with clean boundaries.');
  }

  if (archetype === 'quote-impact' || archetype === 'section-divider') {
    rules.push('Use extreme restraint: silence and negative space are part of the message.');
  }

  return rules;
}

function focalIsolateFor(archetype: SlideArchetype, slide: GenerationSlide) {
  switch (archetype) {
    case 'cover-hero': return 'the title or hero subject should be the lone memorable isolate';
    case 'section-divider': return 'the oversized section title should be the isolate';
    case 'quote-impact': return 'one phrase within the quote should be emphasized more than the rest';
    case 'evidence-proof': return 'one number, proof point, or callout should dominate recall';
    case 'framework-grid': return 'one strategic card or one framing line should hold the isolate';
    default:
      return slide.title ? `the core idea "${slide.title}" should hold the isolate` : 'one clear focal object should dominate memory';
  }
}

function warningFlagsFor(slide: GenerationSlide, density: PresentationFormulaDecision['densityLimits']) {
  const flags: string[] = [];
  if (words(slide.title) > density.maxTitleWords) flags.push(`Title likely too long for clean hierarchy (>${density.maxTitleWords} words).`);
  if (words(slide.body) > density.maxBodyWords) flags.push(`Body likely too dense for one slide (>${density.maxBodyWords} words).`);
  if ((slide.bullets || []).length > density.maxBullets) flags.push(`Too many bullets for this archetype (>${density.maxBullets}).`);
  if ((slide.bullets || []).length > 0 && words((slide.bullets || []).join(' ')) > density.maxBodyWords + 10) flags.push('Bullet payload may read like a document instead of a slide.');
  if ((slide.linkedReferences || []).length === 0) flags.push('No linked references supplied; generation must lean more heavily on deck system defaults.');

  const template = templateLibrary.find((item) => item.id === slide.targetTemplate);
  if (template && (slide.bullets || []).length > (template.constraints.maxBullets || 99)) {
    flags.push(`Bullets exceed template library constraint (${template.constraints.maxBullets}).`);
  }

  return flags;
}

export function derivePresentationFormula(slide: GenerationSlide): PresentationFormulaDecision {
  const archetype = detectArchetype(slide);
  const densityLimits = densityDefaults(archetype);
  const composition = compositionFor(archetype);

  return {
    archetype,
    assertion: deriveAssertion(slide),
    evidenceType: evidenceTypeFor(archetype, slide),
    compositionFormula: composition.formula,
    compositionGuidance: composition.guidance,
    hierarchyFormula: hierarchyFor(archetype),
    cognitiveRules: cognitiveRulesFor(archetype),
    densityLimits,
    focalIsolate: focalIsolateFor(archetype, slide),
    pacingRole: pacingRoleFor(archetype, slide.slideNumber),
    continuityInstructions: [
      'Keep deck DNA stable across all slides: margins, trust level, typographic confidence, and visual polish should feel related.',
      'Use only the previous two slides for local narrative continuity; do not let distant slides distort the current composition.',
      'Vary pacing without breaking identity — release, proof, and escalation should feel like one family.',
      'Prepare for long-deck performance: this slide must hold quality even inside an 86-slide sequence.',
    ],
    warningFlags: warningFlagsFor(slide, densityLimits),
  };
}
