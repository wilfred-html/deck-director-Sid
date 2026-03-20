import { defaultDesignSystem, type DesignSystem } from '../schemas/designSystem';
import type { RedesignPlan } from '../schemas/redesignPlan';
import type { SlideIntent, SlideModel } from '../schemas/slide';
import { templateLibrary, type SlideTemplate } from '../schemas/template';
import { evaluateMediaConsistency } from './media';

function chooseIntent(slide: SlideModel): SlideIntent {
  if (slide.slideNumber === 1) return 'hero';
  if (slide.wordCount <= 12) return 'divider';
  if (slide.wordCount >= 70 && slide.lineCount >= 8) return 'framework';
  if (/summary|conclusion|wrap|next steps/i.test(slide.rawText)) return 'summary';
  if (/timeline|phase|journey|roadmap/i.test(slide.rawText)) return 'timeline';
  if (/quote|said|"/.test(slide.rawText) && slide.wordCount <= 28) return 'quote';
  return 'explain';
}

function chooseTemplate(slide: SlideModel): SlideTemplate {
  const intent = chooseIntent(slide);
  const candidates = templateLibrary.filter((template) => template.intents.includes(intent));
  if (intent === 'framework' && slide.wordCount > 82) {
    return templateLibrary.find((template) => template.id === 'framework-4-card')!;
  }
  if (intent === 'explain' && slide.wordCount <= 38) {
    return templateLibrary.find((template) => template.id === 'text-image-5-7')!;
  }
  return candidates[0] || templateLibrary.find((template) => template.id === 'summary-grid')!;
}

export function buildRedesignPlan(slide: SlideModel, designSystem: DesignSystem = defaultDesignSystem): RedesignPlan {
  const intent = chooseIntent(slide);
  const targetTemplate = chooseTemplate({ ...slide, intent });
  const actions: RedesignPlan['actions'] = [];
  const notes: string[] = [];
  const mediaDecisions: RedesignPlan['mediaDecisions'] = [];

  if (slide.wordCount > targetTemplate.constraints.maxWords) {
    actions.push({
      type: 'compress-copy',
      reason: `Slide carries ${slide.wordCount} words, above the ${targetTemplate.constraints.maxWords}-word target for ${targetTemplate.label}.`,
    });
  }

  if (slide.headingLength > 44) {
    actions.push({
      type: 'rewrite-title',
      reason: 'Heading is likely too long for clean hierarchy and will risk awkward wrapping.',
    });
  }

  if (slide.lineCount > 9) {
    actions.push({
      type: 'convert-to-bullets',
      reason: 'Slide has too many text lines for clean presentation rhythm; group into bullets or cards.',
    });
  }

  if (slide.wordCount > 110) {
    actions.push({
      type: 'split-slide',
      reason: 'Content density is high enough that the material should likely become two slides.',
    });
  }

  actions.push({
    type: 'change-template',
    reason: `Map the slide into ${targetTemplate.label} to enforce repeatable structure.`,
  });

  actions.push({
    type: 'normalize-footer',
    reason: 'Lock footer/logo behavior so the slide matches the global deck system.',
  });

  for (const element of slide.elements) {
    if (!element.media) continue;
    const mediaCheck = evaluateMediaConsistency(element.media, designSystem);
    mediaDecisions.push({ action: mediaCheck.action, reason: mediaCheck.reason });
    if (mediaCheck.action === 'replace') {
      actions.push({ type: 'replace-image', reason: mediaCheck.reason });
    } else if (mediaCheck.action === 'retreat') {
      actions.push({ type: 'retreat-image', reason: mediaCheck.reason });
    }
  }

  notes.push(`Detected intent: ${intent}.`);
  notes.push(`Selected template: ${targetTemplate.id}.`);
  if (designSystem.mediaPolicy.preferredWorld === 'mixed-controlled') {
    notes.push('Mixed real and AI imagery is allowed, but only if treatment remains visually coherent across the deck.');
  }

  const confidence = Math.max(0.52, Math.min(0.94, 0.9 - Math.max(0, slide.wordCount - 50) / 250));

  return {
    slideNumber: slide.slideNumber,
    sourceIntent: intent,
    targetTemplateId: targetTemplate.id,
    confidence: Number(confidence.toFixed(2)),
    actions,
    mediaDecisions,
    notes,
    targetTemplate,
    designSystem,
  };
}
