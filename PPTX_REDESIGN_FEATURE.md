# PPTX Redesign Feature for Deck Director

## The workflow

1. **Upload PPTX**
   - user uploads an existing PowerPoint deck (e.g., 86 slides)
   
2. **Extract slides as images**
   - backend converts each slide to a PNG/JPG image
   
3. **Import as a deck version**
   - each slide becomes a record in Airtable or temp storage
   - slide number + original image + optional text extraction
   
4. **Select reference slides**
   - user marks 2-4 slides that have good visual consistency
   - those become the style anchors for the redesign
   
5. **Bulk regenerate**
   - for each slide:
     - current slide image
     - selected reference slides
     - prompt: redesign to match visual consistency
     - Nano Banana 2 generates new version
   
6. **Edit individual slides**
   - use existing edit assistant to tweak specific slides

## Why this is valuable

- Works on **existing decks**, not just Airtable rows
- Solves "I have an inconsistent 86-slide deck; make it consistent"
- Uses AI as a **redesign engine**, not just creation
- Natural complement to the Airtable-first workflow

## Implementation plan

### Phase 1: PPTX extraction
- upload endpoint
- PPTX → image pipeline (via pdf-lib or similar)
- store extracted images + slide metadata

### Phase 2: Import flow
- create deck version from extracted slides
- display extracted slides in UI
- mark slides as "imported from PPTX"

### Phase 3: Reference selector
- UI to select reference slides
- store selected references per deck version

### Phase 4: Bulk regenerate
- endpoint to trigger regeneration for all slides
- use selected references + current slide image
- write generated outputs back

### Phase 5: Polish
- progress tracking for bulk operations
- retry failed slides
- compare original vs regenerated side-by-side

## Status

Planning phase — will implement PPTX extraction first.
