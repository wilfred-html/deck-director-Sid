import type { GenerationSlide, SlideArchetype } from './presentationFormulaEngine';

export type ImageryRole = 'atmosphere' | 'evidence' | 'explanation' | 'memory-anchor' | 'pace-control' | 'none';
export type ImageryMode = 'documentary-photo' | 'cinematic-concept' | 'screenshot' | 'annotated-proof' | 'diagrammatic' | 'texture-field' | 'none';
export type ImageDominance = 'full-bleed' | 'split-layout' | 'inset-support' | 'background-support' | 'none';

export interface ImageryDecision {
  role: ImageryRole;
  mode: ImageryMode;
  dominance: ImageDominance;
  purpose: string;
  shouldUseImagery: boolean;
  audienceTwoSecondRead: string;
  memoryGoal: string;
  cropRules: string[];
  trustRules: string[];
  styleRules: string[];
  antiPatterns: string[];
}

function mediaHint(slide: GenerationSlide) {
  return (slide.mediaType || '').toLowerCase();
}

function roleFor(archetype: SlideArchetype, slide: GenerationSlide): ImageryRole {
  if (mediaHint(slide) === 'none') return 'none';
  switch (archetype) {
    case 'cover-hero': return 'atmosphere';
    case 'section-divider': return 'pace-control';
    case 'evidence-proof': return 'evidence';
    case 'timeline':
    case 'framework-grid': return mediaHint(slide) === 'chart' || mediaHint(slide) === 'screenshot' ? 'explanation' : 'none';
    case 'quote-impact': return 'memory-anchor';
    case 'summary-close': return 'memory-anchor';
    case 'comparison': return 'evidence';
    case 'narrative-image-led': return 'atmosphere';
    case 'narrative-text-led': return slide.visualBrief ? 'explanation' : 'none';
    default: return 'none';
  }
}

function modeFor(role: ImageryRole, archetype: SlideArchetype, slide: GenerationSlide): ImageryMode {
  const hint = mediaHint(slide);
  if (role === 'none') return 'none';
  if (hint === 'screenshot') return role === 'evidence' ? 'annotated-proof' : 'screenshot';
  if (hint === 'chart') return 'diagrammatic';
  if (hint === 'real') return role === 'evidence' ? 'documentary-photo' : 'documentary-photo';
  if (archetype === 'section-divider') return 'texture-field';
  if (role === 'memory-anchor' || role === 'atmosphere') return 'cinematic-concept';
  if (role === 'explanation') return 'diagrammatic';
  return 'cinematic-concept';
}

function dominanceFor(role: ImageryRole, archetype: SlideArchetype): ImageDominance {
  switch (role) {
    case 'none': return 'none';
    case 'atmosphere': return archetype === 'cover-hero' ? 'full-bleed' : 'background-support';
    case 'pace-control': return 'background-support';
    case 'memory-anchor': return 'split-layout';
    case 'evidence': return 'split-layout';
    case 'explanation': return 'inset-support';
    default: return 'split-layout';
  }
}

export function deriveImageryDecision(slide: GenerationSlide, archetype: SlideArchetype): ImageryDecision {
  const role = roleFor(archetype, slide);
  const mode = modeFor(role, archetype, slide);
  const dominance = dominanceFor(role, archetype);

  return {
    role,
    mode,
    dominance,
    shouldUseImagery: role !== 'none',
    purpose:
      role === 'atmosphere' ? 'Establish tone, world, ambition, and emotional context.' :
      role === 'evidence' ? 'Support the slide’s claim with visual proof or concrete specificity.' :
      role === 'explanation' ? 'Make the concept easier to understand faster than text alone.' :
      role === 'memory-anchor' ? 'Create a memorable visual residue that sticks after the slide passes.' :
      role === 'pace-control' ? 'Lighten the cognitive load and create a pacing reset in the deck.' :
      'Prefer clarity without imagery on this slide.',
    audienceTwoSecondRead:
      role === 'none' ? 'This slide is structural; grasp the assertion before looking for decoration.' :
      role === 'evidence' ? 'The image should immediately signal what is being proven.' :
      role === 'explanation' ? 'The image should immediately clarify the structure or mechanism.' :
      role === 'memory-anchor' ? 'The image should leave one striking emotional or symbolic impression.' :
      'The image should immediately communicate mood, world, and context.',
    memoryGoal:
      role === 'none' ? 'Remember the claim, not an unnecessary image.' :
      role === 'evidence' ? 'Remember the proof object or concrete visual fact.' :
      role === 'explanation' ? 'Remember the concept through visual simplification.' :
      role === 'memory-anchor' ? 'Remember one standout image moment associated with the slide’s message.' :
      'Remember the emotional world and deck tone of the slide.',
    cropRules: [
      'Use one dominant subject or one coherent visual system.',
      'Ensure the image survives a 16:9 slide crop cleanly.',
      'Preserve negative space when the slide needs headline placement.',
      'Avoid image zones with too many competing focal points.',
    ],
    trustRules: [
      'Prefer specificity over generic stock feeling.',
      'Prefer context-fit over pure spectacle.',
      'Keep the image commercially credible and presentation-appropriate.',
      'Do not let style undermine trust in the slide’s message.',
    ],
    styleRules: [
      'Match the global deck DNA and reference-style tone.',
      'Keep image treatment consistent with adjacent slides without becoming repetitive.',
      'Use the image to support presentation composition, not overwhelm it.',
    ],
    antiPatterns: [
      'Do not use random decorative stock imagery.',
      'Do not create collage chaos with multiple unrelated images.',
      'Do not add images that compete with the assertion or reduce clarity.',
      'Do not generate fake-looking spectacle when the slide needs trust and proof.',
    ],
  };
}
