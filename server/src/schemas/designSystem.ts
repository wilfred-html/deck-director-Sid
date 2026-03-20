import type { MediaSourceType } from './slide';

export interface GridSystem {
  columns: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  gutter: number;
}

export interface TypeScale {
  eyebrow: number;
  h1: number;
  h2: number;
  h3: number;
  body: number;
  caption: number;
}

export interface FooterPolicy {
  logos: 'bottom-right' | 'bottom-left' | 'split' | 'none';
  slideNumbers: boolean;
}

export interface MediaPolicy {
  preferredWorld: 'documentary-cinematic' | 'editorial-premium' | 'mixed-controlled' | 'ai-conceptual';
  allowedSourceTypes: MediaSourceType[];
  mixingRule: 'never-mix' | 'allowed-if-treated-consistently' | 'free-mix';
  defaultActionForMismatch: 'retreat-or-replace' | 'replace' | 'demote';
}

export interface IconPolicy {
  style: 'monoline' | 'filled' | 'illustrated' | 'none';
  maxStylesPerDeck: number;
}

export interface DesignSystem {
  name: string;
  grid: GridSystem;
  typeScale: TypeScale;
  spacingScale: number[];
  colors: {
    background: string;
    text: string;
    secondaryText: string;
    accent: string;
    surface: string;
  };
  mediaPolicy: MediaPolicy;
  iconPolicy: IconPolicy;
  footerPolicy: FooterPolicy;
}

export const defaultDesignSystem: DesignSystem = {
  name: 'Deck Director Default',
  grid: {
    columns: 12,
    marginX: 72,
    marginTop: 56,
    marginBottom: 52,
    gutter: 24,
  },
  typeScale: {
    eyebrow: 11,
    h1: 52,
    h2: 34,
    h3: 22,
    body: 14,
    caption: 10,
  },
  spacingScale: [8, 16, 24, 32, 48, 64, 96],
  colors: {
    background: '#F5F1E8',
    text: '#111111',
    secondaryText: '#4A4A4A',
    accent: '#0C5ADB',
    surface: '#ECE6DA',
  },
  mediaPolicy: {
    preferredWorld: 'mixed-controlled',
    allowedSourceTypes: ['real-photography', 'ai-generated', 'screenshot', 'chart-dataviz'],
    mixingRule: 'allowed-if-treated-consistently',
    defaultActionForMismatch: 'retreat-or-replace',
  },
  iconPolicy: {
    style: 'monoline',
    maxStylesPerDeck: 1,
  },
  footerPolicy: {
    logos: 'bottom-right',
    slideNumbers: true,
  },
};
