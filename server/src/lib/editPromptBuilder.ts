export function buildSlideEditPrompt(args: {
  currentName: string;
  slideNumber: number;
  prompt: string;
  promptSummary?: string;
  notes?: string;
}) {
  return [
    'You are editing an existing presentation slide image for Deck Director using Nano Banana 2.',
    'Preserve the current slide’s overall deck identity, composition quality, presentation feel, and professional polish unless the user explicitly asks for a larger change.',
    'This is an edit request, not a brand new slide from scratch.',
    'Keep the result presentation-native, clean, legible, and commercially credible.',
    '',
    `CURRENT SLIDE: ${args.currentName}`,
    `SLIDE NUMBER: ${args.slideNumber}`,
    args.promptSummary ? `ORIGINAL PROMPT SUMMARY: ${args.promptSummary}` : '',
    args.notes ? `ORIGINAL NOTES: ${args.notes.slice(0, 2000)}` : '',
    '',
    'USER REQUESTED EDIT:',
    args.prompt,
    '',
    'EDIT RULES:',
    '- preserve overall deck style and visual DNA',
    '- change only what the request implies',
    '- keep the slide presentation-like, not poster-like',
    '- maintain high-quality hierarchy and readable composition',
    '- do not introduce random new concepts unless needed to satisfy the edit',
    '- do not add browser UI, app chrome, or mockup framing',
    '',
    'Return the edited slide image only.',
  ].filter(Boolean).join('\n');
}
