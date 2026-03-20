import type { DesignSystem } from './designSystem';
import type { SlideModel, MediaAction } from './slide';
import type { SlideTemplate, TemplateId } from './template';

export interface RedesignAction {
  type:
    | 'rewrite-title'
    | 'compress-copy'
    | 'convert-to-bullets'
    | 'split-slide'
    | 'change-template'
    | 'normalize-footer'
    | 'normalize-icons'
    | 'retreat-image'
    | 'replace-image'
    | 'reposition-content';
  reason: string;
}

export interface MediaDecision {
  action: MediaAction;
  reason: string;
}

export interface RedesignPlan {
  slideNumber: number;
  sourceIntent: SlideModel['intent'];
  targetTemplateId: TemplateId;
  confidence: number;
  actions: RedesignAction[];
  mediaDecisions: MediaDecision[];
  notes: string[];
  targetTemplate: SlideTemplate;
  designSystem: DesignSystem;
}
