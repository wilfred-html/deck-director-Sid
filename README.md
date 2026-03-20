# Deck Director

Deck Director is a presentation consistency audit platform.

## MVP scope
- Upload PDF decks up to 200MB
- Render slide thumbnails
- Extract per-slide text density
- Score consistency and identify likely outliers
- Recommend: keep, light cleanup, or rebuild
- Map slides into template archetypes

## Stack
- Client: React + TypeScript + Vite
- API: Express + TypeScript
- Render: static frontend + Node API
- Native tools: `pdfinfo`, `pdftoppm`, `pdftotext`

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

Set `VITE_API_BASE` in the client if needed.

## Roadmap
- PPTX ingestion
- Reference-slide selection
- Visual similarity scoring
- Brand kits and design tokens
- Human-in-the-loop redesign actions
- Deck refactor/export
