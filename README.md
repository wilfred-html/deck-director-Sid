# Deck Director

Deck Director is an **AI-first slide generation system**.

The product direction is now explicit:

- **Source of truth:** Airtable rows
- **Generation engine:** Nano Banana 2 via OpenRouter (`google/gemini-3.1-flash-image-preview`)
- **Continuity logic:** current row + previous 2 rows + fixed global deck system
- **Reference DNA:** linked style anchors such as slides 1, 9, and 12
- **Primary output:** generated slide visuals written back into Airtable for review

SVG rendering remains in the codebase only as a **fallback/debug path** when AI generation fails. It is not the intended product output.

## Current system flow

1. Airtable rows are fetched from the Deck Director base
2. Rows are compiled into structured slide plans
3. Prompt packages are assembled from:
   - row content
   - rolling context
   - reference styles
   - deck-system rules
4. Nano Banana 2 generates slide visuals
5. Generated assets are written back into Airtable for review

## Stack
- Client: React + TypeScript + Vite
- API: Express + TypeScript
- Render: static frontend + Node API
- AI generation: OpenRouter image generation
- Fallback native tools still available for legacy audit mode: `pdfinfo`, `pdftoppm`, `pdftotext`

## Environment

### API
- `OPENROUTER_API_KEY` — required for AI slide generation
- `OPENROUTER_IMAGE_MODEL` — defaults to `google/gemini-3.1-flash-image-preview`
- `DECK_DIRECTOR_GENERATION_ENGINE` — defaults to `nano-banana-2`
- `AIRTABLE_ACCESS_TOKEN` or `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`
- `CLIENT_ORIGIN`

### Client
- `VITE_API_BASE`

## Local development

### API
```bash
cd server
npm install
npm run dev
```

### Client
```bash
cd client
npm install
npm run dev
```

## Near-term priorities
- tighten Nano Banana 2 prompt contract
- improve generated-slide review flow in the app
- add rerun / variant / approval loop
- attach richer generation metadata back into Airtable
- add final export path once generation quality is stable
