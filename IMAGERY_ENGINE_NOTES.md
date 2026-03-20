# Deck Director Imagery Engine Notes

## What was added

Deck Director now has an imagery-decision layer that runs before prompt generation.

It decides:
- whether a slide should use imagery at all
- imagery role
- imagery mode
- imagery dominance
- purpose of the image on that slide
- what the audience should understand in 2 seconds
- what memory residue the image should leave
- crop rules
- trust rules
- style rules
- anti-patterns to avoid

## Why this matters

This prevents the system from treating imagery as:
- generic stock decoration
- random cinematic wallpaper
- forced eye candy on structural slides

Instead, imagery becomes an explicit presentation decision.

## Roles now recognized
- atmosphere
- evidence
- explanation
- memory-anchor
- pace-control
- none

## Next logical improvements
1. Feed imagery decisions into reviewer UI so humans can inspect the role per slide
2. Add per-row overrides for imagery role/mode/dominance
3. Add image-quality scoring for generated outputs after creation
4. Add slide-sequence pacing analysis so imagery intensity varies intentionally across the deck
