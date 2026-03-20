import type { MediaDescriptor, MediaSourceType, SlideElement } from '../schemas/slide';
import type { DesignSystem } from '../schemas/designSystem';

const aiHints = ['render', 'surreal', 'hyperreal', 'concept', 'ai', 'synthetic', 'glossy-3d'];
const realHints = ['documentary', 'editorial', 'candid', 'stadium', 'crowd', 'photography'];

export function classifyMediaFromContext(text: string, role: SlideElement['role']): MediaDescriptor {
  const lower = text.toLowerCase();
  const aiScore = aiHints.reduce((sum, hint) => sum + (lower.includes(hint) ? 1 : 0), 0);
  const realScore = realHints.reduce((sum, hint) => sum + (lower.includes(hint) ? 1 : 0), 0);

  let sourceType: MediaSourceType = 'unknown';
  if (role === 'logo-lockup') sourceType = 'logo-brandmark';
  else if (role === 'chart') sourceType = 'chart-dataviz';
  else if (role === 'supporting-image' || role === 'hero-image' || role === 'background-image') {
    sourceType = aiScore > realScore ? 'ai-generated' : realScore > 0 ? 'real-photography' : 'unknown';
  }

  return {
    sourceType,
    styleTags: sourceType === 'ai-generated' ? ['conceptual', 'styled'] : sourceType === 'real-photography' ? ['editorial', 'documentary'] : [],
    qualityScore: 0.72,
    realismScore: sourceType === 'ai-generated' ? 0.58 : sourceType === 'real-photography' ? 0.88 : 0.5,
    artifactScore: sourceType === 'ai-generated' ? 0.42 : 0.12,
    consistencyScore: 0.68,
    recommendedAction: 'keep',
  };
}

export function evaluateMediaConsistency(media: MediaDescriptor, designSystem: DesignSystem) {
  const allowed = designSystem.mediaPolicy.allowedSourceTypes.includes(media.sourceType);
  const mixedControlled = designSystem.mediaPolicy.preferredWorld === 'mixed-controlled';

  if (!allowed) {
    return {
      score: 0.34,
      action: designSystem.mediaPolicy.defaultActionForMismatch === 'replace' ? 'replace' : 'retreat',
      reason: `Media source type ${media.sourceType} is outside the allowed deck policy.`,
    } as const;
  }

  if (media.sourceType === 'ai-generated' && media.artifactScore > 0.4 && !mixedControlled) {
    return {
      score: 0.45,
      action: 'replace',
      reason: 'AI image artifacts are too visible for the current deck media policy.',
    } as const;
  }

  if (media.sourceType === 'ai-generated' && media.artifactScore > 0.4) {
    return {
      score: 0.6,
      action: 'retreat',
      reason: 'AI image can remain only if it is visually treated to match the rest of the deck.',
    } as const;
  }

  return {
    score: 0.84,
    action: 'keep',
    reason: 'Media appears compatible with the current deck media policy.',
  } as const;
}
