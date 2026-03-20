# Deck Director Formula Engine Notes

## What was added

Deck Director now derives a per-slide presentation formula before building the AI prompt.

This includes:
- slide archetype detection
- assertion derivation
- evidence-type selection
- composition formula selection
- density limits
- focal isolate instruction
- pacing role in deck sequence
- continuity instructions for long-deck generation
- warning flags for overloaded rows

## Why this matters

This shifts the system from:
- "generate a pretty slide"

to:
- "generate a presentation-native slide using cognitive, compositional, and narrative rules"

## Long-deck behavior

The formula engine explicitly acknowledges long runs such as **86 slides**.
That means prompts now remind the model to:
- preserve deck DNA
- vary pacing without losing identity
- prevent repetitive sameness
- avoid long-range drift by using rolling context + stable system rules

## Next logical improvements

1. Add archetype-specific prompt exemplars
2. Add section-level pacing planning across the deck
3. Add preflight splitting/compression suggestions for overloaded rows
4. Add reviewer controls for preferred formula overrides per row
