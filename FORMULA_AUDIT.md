# Formula Integration Audit (2026-03-20)

## Audit Question
Are presentation formulas actually being used in slide generation?

## Audit Result: ✅ YES — Fully Integrated

### Execution Flow

1. **User triggers generation** (`POST /api/generate/from-airtable`)
   - File: `server/src/index.ts:254`
   - Calls: `generateFromAirtable(versionId, excludeLogos)`

2. **For each slide** (loop in `generateFromAirtable`)
   - File: `server/src/generate.ts:117-120`
   - Calls: `buildGenerationPrompt(slide, excludeLogos)`
   - Calls: `buildPromptPackage(slide, excludeLogos)`

3. **Prompt builder invokes formula engine**
   - File: `server/src/lib/promptBuilder.ts:3`
   - Line 3: `const formula = derivePresentationFormula(slide);`
   - This is the critical integration point

4. **Formula engine analyzes slide**
   - File: `server/src/lib/presentationFormulaEngine.ts:95-280`
   - Function: `derivePresentationFormula(slide: GenerationSlide)`
   - Steps:
     1. Detect archetype (cover-hero, narrative-text-led, framework-grid, etc.)
     2. Determine pacing role (anchor, escalation, release, proof, bridge, close)
     3. Derive assertion from title/body
     4. Detect evidence type (photo, diagram, abstraction, text-only)
     5. Select composition formula (rule-of-thirds, phi-split, editorial-grid, etc.)
     6. Generate composition guidance (asymmetry, golden-ratio, grid rules)
     7. Apply hierarchy formula (headline → subhead → supporting → footnotes)
     8. Apply cognitive rules (coherence, signaling, contiguity, segmenting, Von Restorff)
     9. **Call imagery decision engine** (`deriveImageryDecision`)
     10. Set density limits (max title words, max bullets, max clusters, max callouts)
     11. Identify focal isolate (one memorable element per slide)
     12. Generate continuity instructions (reference previous 2 slides)
     13. Check for warning flags (cognitive overload, formula mismatch)

5. **Imagery decision engine runs**
   - File: `server/src/lib/imageryDecisionEngine.ts:20-195`
   - Function: `deriveImageryDecision(slide: GenerationSlide)`
   - Determines:
     - Should imagery be used? (yes/no)
     - Imagery role (atmosphere, evidence, explanation, memory-anchor, pace-control, none)
     - Imagery mode (documentary, cinematic, screenshot, annotated-proof, diagrammatic, texture, none)
     - Imagery dominance (full-bleed, split, inset, background, none)
     - Crop rules, trust rules, style rules, anti-patterns
     - Purpose, two-second read, memory goal

6. **Formula output included in prompt**
   - File: `server/src/lib/promptBuilder.ts:84-148`
   - Lines included in final prompt:
     - `ARCHETYPE: ${formula.archetype}`
     - `PACING ROLE IN DECK: ${formula.pacingRole}`
     - `ASSERTION: ${formula.assertion}`
     - `EVIDENCE TYPE: ${formula.evidenceType}`
     - `COMPOSITION FORMULA: ${formula.compositionFormula}`
     - `FOCAL ISOLATE: ${formula.focalIsolate}`
     - `IMAGERY ROLE: ${formula.imagery.role}`
     - `IMAGERY MODE: ${formula.imagery.mode}`
     - `IMAGERY DOMINANCE: ${formula.imagery.dominance}`
     - `DENSITY LIMITS:` (all 5 limits)
     - `COMPOSITION GUIDANCE:` (array of rules)
     - `HIERARCHY RULES:` (array of rules)
     - `COGNITIVE RULES:` (array of rules)
     - `IMAGERY DECISION:` (full decision tree)
     - `CONTINUITY INSTRUCTIONS:` (array of rules)
     - `WARNING FLAGS:` (if any)

7. **Prompt sent to Nano Banana 2**
   - File: `server/src/generate.ts:125`
   - Model: `google/gemini-3.1-flash-image-preview`
   - Aspect ratio: `16:9`
   - References: linked reference slides from Airtable

## Formula Coverage

### ✅ Implemented & Active
- [x] Archetype detection (10 archetypes)
- [x] Pacing role assignment (6 roles)
- [x] Assertion derivation
- [x] Evidence type detection
- [x] Composition formula selection (5 formulas)
- [x] Composition guidance generation
- [x] Hierarchy formula (4-tier system)
- [x] Cognitive rules (5 principles: coherence, signaling, contiguity, segmenting, Von Restorff)
- [x] Imagery decision engine (full integration)
- [x] Density limits (5 constraints per archetype)
- [x] Focal isolate identification
- [x] Continuity instructions (rolling context window)
- [x] Warning flags (cognitive overload detection)

### Research Foundations
All formulas derived from:
- `PRESENTATION_FORMULAS_RESEARCH.md` (composition, hierarchy, cognition)
- `PRESENTATION_IMAGERY_RESEARCH.md` (imagery purpose, trust, crop rules)

## Example Formula Output (narrative-text-led slide)

```typescript
{
  archetype: 'narrative-text-led',
  pacingRole: 'escalation',
  assertion: 'The culture is fragmented across many spaces',
  evidenceType: 'photo',
  compositionFormula: 'phi-split',
  compositionGuidance: [
    'Use asymmetrical composition with golden-ratio proportions',
    'One dominant element at 62%, supporting at 38%',
    'Keep negative space breathing',
  ],
  hierarchyFormula: [
    'Headline: bold, large, unmissable',
    'Subhead: medium weight, smaller size',
    'Supporting: normal weight, readable',
    'Footnotes: light weight, smallest',
  ],
  cognitiveRules: [
    'Coherence: related material should be near each other',
    'Signaling: highlight the one thing they must remember',
    'Contiguity: text near its corresponding visual',
    'Segmenting: chunk information into digestible groups',
    'Von Restorff: one distinctive isolate per slide',
  ],
  imagery: {
    shouldUseImagery: true,
    role: 'atmosphere',
    mode: 'documentary',
    dominance: 'split',
    purpose: 'Establish mood and cultural context',
    audienceTwoSecondRead: 'People celebrating football culture',
    memoryGoal: 'Fragmented passion across many places',
    cropRules: [...],
    trustRules: [...],
    styleRules: [...],
    antiPatterns: [...],
  },
  densityLimits: {
    maxTitleWords: 10,
    maxBodyWords: 35,
    maxBullets: 4,
    maxVisibleClusters: 3,
    maxPrimaryCallouts: 2,
  },
  focalIsolate: 'One dominant visual or headline element',
  continuityInstructions: [
    'Reference previous 2 slides for narrative flow',
    'Maintain deck DNA across all slides',
    'Keep stable visual system',
  ],
  warningFlags: [],
}
```

## Verification Steps Performed

1. ✅ Traced code path from API endpoint → generation loop → prompt builder → formula engine
2. ✅ Verified `derivePresentationFormula` is called for every slide
3. ✅ Verified `deriveImageryDecision` is called within formula derivation
4. ✅ Confirmed formula output is included in final prompt text
5. ✅ Confirmed prompt is sent to OpenRouter with references
6. ✅ Verified all 10 archetypes have density limits
7. ✅ Verified all 5 composition formulas are defined
8. ✅ Verified imagery decision engine has full coverage (role, mode, dominance, rules)

## Conclusion

**The presentation formulas are 100% integrated and active.**

Every slide generated by Deck Director:
1. Gets analyzed by the formula engine
2. Gets assigned an archetype, pacing role, composition formula, and density limits
3. Goes through the imagery decision engine
4. Has all formula guidance included in the generation prompt
5. Is sent to Nano Banana 2 with structured presentation intelligence

The formulas are not decorative — they're load-bearing infrastructure in the generation flow.

## Next Steps (Optional Enhancements)

- [ ] Add formula debugging mode (log derived formulas to console)
- [ ] Add formula override UI (let user tweak archetype/composition per slide)
- [ ] Add formula visualization in viewer (show which formula was used)
- [ ] Add formula metrics tracking (which archetypes/formulas perform best)
- [ ] Add formula A/B testing (compare formula-driven vs raw generation)
