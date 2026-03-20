export function buildSlideEditPrompt(args: {
  currentName: string;
  slideNumber: number;
  prompt: string;
  promptSummary?: string;
  notes?: string;
  hasReferenceImages?: boolean;
}) {
  const lines: string[] = [
    'You are editing an existing presentation slide image for Deck Director using Nano Banana 2.',
    'Preserve the current slide\'s overall deck identity, composition quality, presentation feel, and professional polish unless the user explicitly asks for a larger change.',
    'This is an edit request, not a brand new slide from scratch.',
    'Keep the result presentation-native, clean, legible, and commercially credible.',
    '',
    'CURRENT SLIDE: ' + args.currentName,
    'SLIDE NUMBER: ' + args.slideNumber,
  ];

  if (args.promptSummary) {
    lines.push('ORIGINAL PROMPT SUMMARY: ' + args.promptSummary);
  }

  if (args.notes) {
    lines.push('ORIGINAL NOTES: ' + args.notes.slice(0, 2000));
  }

  if (args.hasReferenceImages) {
    lines.push('USER PROVIDED REFERENCE IMAGES: yes; absorb elements from them as needed for the requested edit');
  }

  lines.push('');
  lines.push('USER REQUESTED EDIT:');
  lines.push(args.prompt);
  lines.push('');
  lines.push('EDIT RULES:');
  lines.push('- preserve overall deck style and visual DNA');
  lines.push('- change only what the request implies');
  lines.push('- keep the slide presentation-like, not poster-like');
  lines.push('- maintain high-quality hierarchy and readable composition');
  lines.push('- do not introduce random new concepts unless needed to satisfy the edit');
  lines.push('- do not add browser UI, app chrome, or mockup framing');

  if (args.hasReferenceImages) {
    lines.push('- if reference images were provided, use elements from them as inspiration or direct visual references as implied by the edit request');
  }

  lines.push('');
  lines.push('Return the edited slide image only.');

  return lines.filter(Boolean).join('\n');
}
