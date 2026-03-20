# Deck Director — AI Generation Roadmap

## Locked direction

Deck Director is **not** an SVG/HTML slide renderer product.
It is an **AI-native slide generation system**.

Primary engine:
- **Nano Banana 2** via OpenRouter
- Model id: `google/gemini-3.1-flash-image-preview`

## Current architecture

- Airtable = canonical deck/row/reference database
- Compiler = row normalization + template targeting + rolling context
- Prompt builder = converts structured slide records into generation-ready prompt packages
- Generator = sends prompt + linked references to OpenRouter image generation
- Airtable write-back = stores generated assets and metadata for review

## What must happen next

### 1. Prompt quality system
- strengthen per-template prompt directives
- improve role of references 1 / 9 / 12
- tune text density instructions
- create generation presets by slide intent:
  - cover
  - divider
  - narrative
  - framework
  - evidence
  - summary

### 2. Review loop
- generated slide gallery in app
- single-slide inspection panel
- show prompt summary / prompt package / references used
- approve / reject / regenerate controls
- variant support

### 3. Generation observability
- render run history UI
- failure reason visibility
- model + engine tracking
- retries / regeneration counters

### 4. Output layer
- after quality stabilizes, add export path:
  - PPTX
  - PDF
  - or downstream slide assembly pipeline

## Transitional note

SVG preview rendering should remain only as:
- a debug fallback
- a visibility tool when AI generation fails

It should not shape product decisions going forward.
