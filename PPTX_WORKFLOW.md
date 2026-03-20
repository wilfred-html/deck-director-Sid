# PPTX Redesign Workflow (Manual + AI)

## Current implementation status

**Phase 1** (manual extraction + AI redesign): ✅ Ready to use  
**Phase 2** (batch upload): ✅ Ready to use  
**Phase 3** (automatic PPTX extraction): 🚧 Coming next

## How to use it now (manual workflow)

### Step 1: Export your deck slides as images

From PowerPoint, Keynote, or Google Slides:
- **PowerPoint:** File → Export → PNG/JPG → Export All Slides
- **Keynote:** File → Export To → Images → Export all slides
- **Google Slides:** File → Download → PNG or JPEG (downloads as zip)

This gives you: `slide-001.png`, `slide-002.png`, ..., `slide-086.png`

### Step 2: Upload images to Deck Director

Use the batch upload feature (coming) or:
1. Create a new deck version in Airtable manually
2. Upload slide images to the `Generated Slides` table
3. Link them to the version

### Step 3: Select reference slides

In the Deck Director viewer:
1. Navigate through the imported slides
2. Mark 2-4 slides that have the visual consistency you want
3. Click "Set as style references"

### Step 4: Bulk regenerate

1. Click "Regenerate all slides" in the deck version view
2. System processes each slide with:
   - current slide image
   - selected reference slides
   - prompt: "Redesign this slide to match the visual consistency, typography, and composition of the reference slides. Preserve the slide content and intent."
3. Nano Banana 2 generates new versions
4. Results written back to Airtable

### Step 5: Edit individual slides

Use the existing edit assistant to fine-tune specific slides.

## What's being built next

### Automatic PPTX extraction

Upload PPTX → system extracts slides automatically → ready for step 3.

**Technical approach:**
- PPTX → PDF (via LibreOffice headless or cloud service)
- PDF → PNG images (via pdftoppm)
- Store extracted images + create deck version

**ETA:** Next session

## Why this workflow works

- **Immediate:** You can use it today with manual export
- **AI-powered:** Bulk redesign uses the same Nano Banana 2 engine
- **Reference-driven:** Visual consistency comes from YOUR chosen slides
- **Iterative:** Edit assistant lets you fix individual slides after bulk

## Example: 86-slide deck redesign

1. Export 86 slides from PowerPoint as PNGs (2 minutes)
2. Batch upload to Deck Director (5 minutes)
3. Select 3 reference slides you like (1 minute)
4. Bulk regenerate (15-20 minutes, automated)
5. Review + edit 5-10 slides that need tweaks (10 minutes)

**Total time:** ~35 minutes for full redesign vs. days of manual work.
