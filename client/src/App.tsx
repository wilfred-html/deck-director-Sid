import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

type SchemaField = { key: string; label: string; required: boolean; description: string; example?: string };
type CompilerStage = { name: string; description: string };
type FormulaSystem = {
  layout: { primarySplit: string; fallbackSplits: string[]; grid: string; rule: string };
  typography: { modularScale: string[]; hierarchy: string; lineLength: string; densityRule: string };
  spacing: { rhythm: string; steps: number[]; rule: string };
  performance: { generationMode: string; contextWindow: string; reason: string; batchingRule: string };
};

type CompilerSpec = {
  productDirection: string;
  summary: string;
  rollingWindowRule: { strategy: string; currentRow: string; lookbackRows: number; examples: string[]; note: string };
  deckRowSchema: SchemaField[];
  compilerStages: CompilerStage[];
  designFormulaSystem: FormulaSystem;
};

type AirtableSnapshot = {
  baseId: string;
  decks: Array<{ id: string; name: string; status: string; currentVersion: string; brandClient: string; description: string }>;
  versions: Array<{ id: string; name: string; number: string; status: string; compilerMode: string; deckIds: string[] }>;
  referenceStyles: Array<{ id: string; name: string; role: string; mediaWorld: string; styleNotes: string; keywords: string; imageUrl: string; deckIds: string[] }>;
  slideRows: Array<{ id: string; versionIds: string[]; referenceStyleIds: string[]; slide_number: string; section: string; intent: string; layout_type: string; title: string; subtitle: string; body: string; bullets: string; visual_brief: string; media_type: string; chart_type: string; speaker_notes: string; must_keep: string; emphasis: string; reference_image_ids: string; design_notes: string }>;
};

type CompiledSlide = {
  slideNumber: number;
  section: string;
  intent: string;
  targetTemplate: string;
  title: string;
  subtitle: string;
  body: string;
  bullets: string[];
  visualBrief: string;
  mediaType: string;
  emphasis: string;
  rollingContext: Array<{ slide_number: string; title: string; section: string; intent: string; layout_type: string }>;
  linkedReferences?: Array<{ id: string; name: string; role: string; mediaWorld: string; styleNotes: string; keywords: string; imageUrl: string }>;
};

type CompileResult = { rowCount: number; validRowCount: number; invalidRows: Array<{ rowNumber: number; missing: string[]; valid: boolean }>; compiledSlides: CompiledSlide[]; versionId?: string };
type GenerateResult = { runId: string; versionId: string; generatedCount: number; model: string; engine?: string };

type GeneratedSlide = {
  id: string;
  name: string;
  status: string;
  promptSummary: string;
  layoutJson: string;
  notes: string;
  model: string;
  previewImageUrl: string;
  deckVersionIds: string[];
  slideRowIds: string[];
  renderRunIds: string[];
  iterationNumber: number;
  createdTime?: string;
  slideNumber: number;
};

type GeneratedPresentation = {
  versionId: string;
  runCount: number;
  generatedCount: number;
  generatedSlides: GeneratedSlide[];
};

type EditVariant = {
  generatedSlideId: string;
  prompt: string;
  variantImageUrl: string;
  tempFilePath: string;
  tempFileName: string;
  contentType: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || '';

function App() {
  const [spec, setSpec] = useState<CompilerSpec | null>(null);
  const [snapshot, setSnapshot] = useState<AirtableSnapshot | null>(null);
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [presentation, setPresentation] = useState<GeneratedPresentation | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [selectedGeneratedId, setSelectedGeneratedId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingPresentation, setLoadingPresentation] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [applyingEdit, setApplyingEdit] = useState(false);
  const [draftVariant, setDraftVariant] = useState<EditVariant | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [selectedReferenceSlides, setSelectedReferenceSlides] = useState<Set<string>>(new Set());
  const [bulkRegenerating, setBulkRegenerating] = useState(false);
  const [batchImporting, setBatchImporting] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [globalEditing, setGlobalEditing] = useState(false);
  const [globalEditPrompt, setGlobalEditPrompt] = useState('');
  const [excludeLogos, setExcludeLogos] = useState(false);
  const stageRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/compiler/spec`).then((r) => r.json()),
      fetch(`${API_BASE}/api/airtable/snapshot`).then((r) => r.json()),
    ])
      .then(([specData, snapshotData]) => {
        if (specData.error) throw new Error(specData.error);
        if (snapshotData.error) throw new Error(snapshotData.error);
        setSpec(specData);
        setSnapshot(snapshotData);
        setSelectedVersion(snapshotData.versions?.[0]?.id || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load app data'));
  }, []);

  useEffect(() => {
    if (!selectedVersion) return;
    setBusy(true);
    fetch(`${API_BASE}/api/compiler/from-airtable?versionId=${encodeURIComponent(selectedVersion)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCompiled(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to compile from Airtable'))
      .finally(() => setBusy(false));
  }, [selectedVersion]);

  useEffect(() => {
    if (!selectedVersion) return;
    setLoadingPresentation(true);
    fetch(`${API_BASE}/api/generated/from-airtable?versionId=${encodeURIComponent(selectedVersion)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPresentation(data);
        setSelectedGeneratedId((current) => current && data.generatedSlides.some((slide: GeneratedSlide) => slide.id === current)
          ? current
          : data.generatedSlides[0]?.id || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load generated presentation'))
      .finally(() => setLoadingPresentation(false));
  }, [selectedVersion]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTypingTarget = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      if (isTypingTarget) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelected(1);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSelected(-1);
      }
      if (event.key.toLowerCase() === 'f' && selectedGeneratedId) {
        event.preventDefault();
        void toggleFullscreen();
      }
      if (event.key === 'Escape' && draftVariant) {
        setDraftVariant(null);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [draftVariant, selectedGeneratedId, presentation]);

  const selectedDeck = useMemo(() => {
    if (!snapshot || !selectedVersion) return null;
    const version = snapshot.versions.find((item) => item.id === selectedVersion);
    return snapshot.decks.find((deck) => version?.deckIds.includes(deck.id)) || null;
  }, [snapshot, selectedVersion]);

  const selectedGeneratedSlide = useMemo(() => {
    if (!presentation) return null;
    return presentation.generatedSlides.find((slide) => slide.id === selectedGeneratedId) || presentation.generatedSlides[0] || null;
  }, [presentation, selectedGeneratedId]);

  const selectedCompiledSlide = useMemo(() => {
    if (!compiled || !selectedGeneratedSlide) return null;
    return compiled.compiledSlides.find((slide) => slide.slideNumber === selectedGeneratedSlide.slideNumber) || null;
  }, [compiled, selectedGeneratedSlide]);

  const selectedPromptLines = useMemo(() => {
    return (selectedGeneratedSlide?.promptSummary || '').split('\n').filter(Boolean);
  }, [selectedGeneratedSlide]);

  async function refreshPresentation(versionId: string) {
    const data = await fetch(`${API_BASE}/api/generated/from-airtable?versionId=${encodeURIComponent(versionId)}`).then((r) => r.json());
    if (data.error) throw new Error(data.error);
    setPresentation(data);
    setSelectedGeneratedId((current) => current && data.generatedSlides.some((slide: GeneratedSlide) => slide.id === current)
      ? current
      : data.generatedSlides[0]?.id || '');
  }

  async function handleGenerate() {
    if (!selectedVersion) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/generate/from-airtable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: selectedVersion, excludeLogos }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate');
      setGenerateResult(data);
      const refreshedCompiled = await fetch(`${API_BASE}/api/compiler/from-airtable?versionId=${encodeURIComponent(selectedVersion)}`).then((r) => r.json());
      setCompiled(refreshedCompiled);
      await refreshPresentation(selectedVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }

  function moveSelected(delta: number) {
    if (!presentation?.generatedSlides.length || !selectedGeneratedSlide) return;
    const index = presentation.generatedSlides.findIndex((slide) => slide.id === selectedGeneratedSlide.id);
    const next = presentation.generatedSlides[index + delta];
    if (next) {
      setSelectedGeneratedId(next.id);
      setDraftVariant(null);
    }
  }

  async function toggleFullscreen() {
    if (!stageRef.current) return;

    if (document.fullscreenElement === stageRef.current) {
      await document.exitFullscreen();
      return;
    }

    await stageRef.current.requestFullscreen();
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          setReferenceImages((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleEditSubmit() {
    if (!selectedGeneratedSlide || !editPrompt.trim()) return;
    setEditing(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/generated/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedSlideId: selectedGeneratedSlide.id, prompt: editPrompt.trim(), referenceImageUrls: referenceImages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create edited variant');
      setDraftVariant(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit current slide');
    } finally {
      setEditing(false);
    }
  }

  async function handleKeepChange() {
    if (!draftVariant) return;
    setApplyingEdit(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/generated/edit/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftVariant),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to apply edited variant');
      setDraftVariant(null);
      setEditPrompt('');
      await refreshPresentation(selectedVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to keep edited slide');
    } finally {
      setApplyingEdit(false);
    }
  }

  function handleCancelDraft() {
    setDraftVariant(null);
  }

  function removeReferenceImage(index: number) {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleReferenceSlide(slideId: string) {
    setSelectedReferenceSlides((prev) => {
      const next = new Set(prev);
      if (next.has(slideId)) {
        next.delete(slideId);
      } else {
        next.add(slideId);
      }
      return next;
    });
  }

  async function handleBulkRegenerate() {
    if (!selectedVersion || selectedReferenceSlides.size === 0) return;
    setBulkRegenerating(true);
    setError(null);
    try {
      const referenceUrls = Array.from(selectedReferenceSlides).map((slideId) => {
        const slide = presentation?.generatedSlides.find((s) => s.id === slideId);
        return slide?.previewImageUrl || '';
      }).filter(Boolean);

      const response = await fetch(`${API_BASE}/api/bulk/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: selectedVersion, referenceImageUrls: referenceUrls }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to bulk regenerate');
      await refreshPresentation(selectedVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk regenerate slides');
    } finally {
      setBulkRegenerating(false);
    }
  }

  async function handleBatchImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setBatchImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('slides', file);
      });
      formData.append('deckName', selectedDeck?.name || 'Imported Deck');
      formData.append('versionName', `Import ${new Date().toISOString().slice(0, 10)}`);

      const response = await fetch(`${API_BASE}/api/batch/import`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to batch import');
      
      setSelectedVersion(data.versionId);
      setShowBatchImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to batch import slides');
    } finally {
      setBatchImporting(false);
    }
  }

  async function handleGlobalEdit() {
    if (!selectedVersion || !globalEditPrompt.trim()) return;
    setGlobalEditing(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/global/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: selectedVersion,
          editPrompt: globalEditPrompt.trim(),
          referenceImageUrls: referenceImages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to apply global edit');
      await refreshPresentation(selectedVersion);
      setGlobalEditPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply global edit');
    } finally {
      setGlobalEditing(false);
    }
  }

  const displayedImageUrl = draftVariant?.variantImageUrl || selectedGeneratedSlide?.previewImageUrl || '';

  return (
    <div className="shell compiler-shell">
      <header className="hero compiler-hero">
        <div className="hero-copy">
          <p className="eyebrow">Deck Director / AI-native generation</p>
          <h1>Generate finished slides from Airtable rows.</h1>
          <p className="lede">Deck Director is now positioned as an AI-first slide engine: Airtable rows, rolling context, and linked reference styles are assembled into prompt packages for Nano Banana 2 generation.</p>
          <ul className="principle-strip">
            <li>Nano Banana 2 primary path</li>
            <li>Reference-driven slide DNA</li>
            <li>Rolling-context generation</li>
          </ul>
        </div>
        <div className="hero-panel">
          <div className="hero-stat"><span>Base</span><strong>{snapshot?.baseId || 'Loading…'}</strong></div>
          <div className="hero-stat"><span>Deck</span><strong>{selectedDeck?.name || '—'}</strong></div>
          <div className="hero-stat"><span>Version</span><strong>{snapshot?.versions.find((item) => item.id === selectedVersion)?.name || '—'}</strong></div>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <main className="dashboard">
        <section className="summary-grid compiler-grid">
          <article><span>Decks</span><strong>{snapshot?.decks.length || 0}</strong><small>available in Airtable</small></article>
          <article><span>Versions</span><strong>{snapshot?.versions.length || 0}</strong><small>compiler-ready versions</small></article>
          <article><span>Slide Rows</span><strong>{snapshot?.slideRows.length || 0}</strong><small>structured source rows</small></article>
          <article><span>Generated Slides</span><strong>{presentation?.generatedCount || 0}</strong><small>currently viewable in the deck viewer</small></article>
        </section>

        <section className="principles">
          <div>
            <p className="eyebrow">Compiler control</p>
            <h2>Select the Airtable version to generate</h2>
          </div>
          <div>
            <div className="control-row">
              <select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
                {(snapshot?.versions || []).map((version) => (
                  <option key={version.id} value={version.id}>{version.name} · {version.status}</option>
                ))}
              </select>
              <label className="toggle-label">
                <input type="checkbox" checked={excludeLogos} onChange={(e) => setExcludeLogos(e.target.checked)} />
                <span>Exclude logos</span>
              </label>
              <button onClick={handleGenerate} disabled={!selectedVersion || generating}>{generating ? 'Generating with Nano Banana 2…' : 'Generate Slides'}</button>
              <button onClick={() => setShowBatchImport(true)}>Batch Import</button>
              <span className="status-pill">{busy ? 'Compiling prompt package…' : generating ? 'Generating + writing back to Airtable…' : 'AI-ready from Airtable'}</span>
            </div>
            {showBatchImport ? (
              <div className="batch-import-panel">
                <input
                  type="file"
                  ref={batchFileInputRef}
                  onChange={handleBatchImport}
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                />
                <p><strong>Batch import slides:</strong> Select all slide images (e.g., slide-001.png through slide-086.png) and they'll be imported as a new deck version.</p>
                <div className="chat-actions">
                  <button onClick={() => batchFileInputRef.current?.click()} disabled={batchImporting}>{batchImporting ? 'Importing…' : 'Choose images'}</button>
                  <button className="ghost-btn" onClick={() => setShowBatchImport(false)} disabled={batchImporting}>Cancel</button>
                </div>
              </div>
            ) : null}
            <p className="media-note">{selectedDeck?.description || spec?.summary}</p>
            {generateResult ? <p className="media-note">Last run: {generateResult.runId} · {generateResult.generatedCount} generated slide records written using {generateResult.engine || 'nano-banana-2'} / {generateResult.model}.</p> : null}
          </div>
        </section>

        <section className="viewer-shell">
          <div className="viewer-header">
            <div>
              <p className="eyebrow">Deck review mode</p>
              <h2>Generated presentation viewer</h2>
            </div>
            <div className="viewer-toolbar">
              <span className="status-pill subtle">{loadingPresentation ? 'Loading presentation…' : `${presentation?.generatedCount || 0} slides viewable`}</span>
              <span className="status-pill subtle">← / → navigate</span>
              {selectedReferenceSlides.size > 0 ? <span className="status-pill">{selectedReferenceSlides.size} reference{selectedReferenceSlides.size !== 1 ? 's' : ''} selected</span> : null}
              <button onClick={() => moveSelected(-1)} disabled={!selectedGeneratedSlide || !presentation || presentation.generatedSlides[0]?.id === selectedGeneratedSlide.id}>Previous</button>
              <button onClick={() => moveSelected(1)} disabled={!selectedGeneratedSlide || !presentation || presentation.generatedSlides[presentation.generatedSlides.length - 1]?.id === selectedGeneratedSlide.id}>Next</button>
              <button onClick={toggleFullscreen} disabled={!selectedGeneratedSlide}>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</button>
              <button onClick={handleBulkRegenerate} disabled={bulkRegenerating || selectedReferenceSlides.size === 0}>{bulkRegenerating ? 'Regenerating…' : 'Bulk Regenerate'}</button>
            </div>
          </div>

          <div className="viewer-grid">
            {!isFullscreen ? (
              <aside className="filmstrip">
                {(presentation?.generatedSlides || []).map((slide) => (
                  <div key={slide.id} className="thumb-wrapper">
                    <button
                      className={`thumb-card ${slide.id === selectedGeneratedId ? 'active' : ''} ${selectedReferenceSlides.has(slide.id) ? 'is-reference' : ''}`}
                      onClick={() => {
                        setSelectedGeneratedId(slide.id);
                        setDraftVariant(null);
                      }}
                    >
                      {slide.previewImageUrl ? <img src={slide.previewImageUrl} alt={slide.name} /> : <div className="thumb-placeholder">No preview</div>}
                      <div className="thumb-meta">
                        <strong>{slide.slideNumber || '—'}</strong>
                        <span>{slide.status}</span>
                      </div>
                    </button>
                    <button
                      className={`ref-toggle ${selectedReferenceSlides.has(slide.id) ? 'active' : ''}`}
                      onClick={() => toggleReferenceSlide(slide.id)}
                      title={selectedReferenceSlides.has(slide.id) ? 'Remove as reference' : 'Set as reference'}
                    >
                      {selectedReferenceSlides.has(slide.id) ? '★' : '☆'}
                    </button>
                  </div>
                ))}
              </aside>
            ) : null}

            <section className={`presentation-stage ${isFullscreen ? 'is-fullscreen' : ''}`} ref={stageRef}>
              <div className="stage-topline">
                <div>
                  <p className="eyebrow">Slide focus</p>
                  <h3>{selectedGeneratedSlide?.name || 'No generated slide selected'}</h3>
                </div>
                {selectedGeneratedSlide ? <span className="stage-counter">Slide {selectedGeneratedSlide.slideNumber}</span> : null}
              </div>

              <div className="stage-canvas-wrap">
                {displayedImageUrl ? (
                  <img className="stage-canvas" src={displayedImageUrl} alt={selectedGeneratedSlide?.name || 'slide'} />
                ) : (
                  <div className="stage-empty">Generate a version to start viewing the presentation.</div>
                )}
              </div>

              {isFullscreen ? (
                <div className={`edit-assistant ${chatOpen ? 'open' : ''}`}>
                  {!chatOpen ? (
                    <button className="chat-fab" onClick={() => setChatOpen(true)}>Edit Slide</button>
                  ) : (
                    <div className="chat-dock">
                      <div className="chat-dock-header">
                        <strong>Slide edit assist</strong>
                        <button className="ghost-btn" onClick={() => setChatOpen(false)}>Close</button>
                      </div>
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="e.g. Make the headline larger, reduce the background clutter, and make the players feel more premium and cinematic."
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                      />
                      <div className="reference-images">
                        {referenceImages.map((url, index) => (
                          <div key={index} className="ref-image-chip">
                            <img src={url} alt={`Reference ${index + 1}`} />
                            <button className="remove-chip" onClick={() => removeReferenceImage(index)}>×</button>
                          </div>
                        ))}
                      </div>
                      <div className="chat-actions">
                        <button onClick={() => fileInputRef.current?.click()} className="ghost-btn">Add reference image</button>
                        <button onClick={handleEditSubmit} disabled={!selectedGeneratedSlide || !editPrompt.trim() || editing}>{editing ? 'Generating edit…' : 'Generate edit'}</button>
                      </div>
                      {draftVariant ? (
                        <div className="draft-actions">
                          <p>Draft ready — keep this change or cancel and keep the current slide.</p>
                          <div className="chat-actions">
                            <button onClick={handleKeepChange} disabled={applyingEdit}>{applyingEdit ? 'Keeping…' : 'Keep change'}</button>
                            <button className="ghost-btn" onClick={handleCancelDraft} disabled={applyingEdit}>Cancel</button>
                          </div>
                        </div>
                      ) : null}
                      
                      <div className="global-edit-divider">
                        <span>Global edit (all slides)</span>
                      </div>
                      
                      <textarea
                        value={globalEditPrompt}
                        onChange={(e) => setGlobalEditPrompt(e.target.value)}
                        placeholder="e.g. Make all text 20% larger"
                      />
                      <button onClick={handleGlobalEdit} disabled={globalEditing || !globalEditPrompt.trim()} className="global-edit-btn">
                        {globalEditing ? 'Applying to all slides…' : 'Apply to All Slides'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            {!isFullscreen ? (
              <aside className="review-panel">
                <div className="review-card">
                  <p className="eyebrow">Generation metadata</p>
                  <h3>Review context</h3>
                  <ul className="plain-list compact">
                    <li><strong>Status:</strong> {selectedGeneratedSlide?.status || '—'}</li>
                    <li><strong>Model:</strong> {selectedGeneratedSlide?.model || generateResult?.model || '—'}</li>
                    <li><strong>Iteration:</strong> {selectedGeneratedSlide?.iterationNumber || '—'}</li>
                    <li><strong>Render runs:</strong> {selectedGeneratedSlide?.renderRunIds.length || 0}</li>
                  </ul>
                </div>

                <div className="review-card">
                  <p className="eyebrow">Prompt summary</p>
                  <h3>What drove this slide</h3>
                  <ul className="plain-list compact">
                    {selectedPromptLines.length ? selectedPromptLines.map((line, index) => <li key={index}>{line}</li>) : <li>No prompt summary found.</li>}
                  </ul>
                </div>

                <div className="review-card">
                  <p className="eyebrow">Compiled slide plan</p>
                  <h3>Source row translated</h3>
                  {selectedCompiledSlide ? (
                    <ul className="plain-list compact">
                      <li><strong>Title:</strong> {selectedCompiledSlide.title}</li>
                      <li><strong>Template:</strong> {selectedCompiledSlide.targetTemplate}</li>
                      <li><strong>Intent:</strong> {selectedCompiledSlide.intent}</li>
                      <li><strong>Section:</strong> {selectedCompiledSlide.section}</li>
                      <li><strong>References:</strong> {(selectedCompiledSlide.linkedReferences || []).map((ref) => ref.name).join(' · ') || '—'}</li>
                    </ul>
                  ) : <p className="media-note">No compiled plan matched this generated slide.</p>}
                </div>
              </aside>
            ) : null}
          </div>
        </section>

        <section className="principles">
          <div>
            <p className="eyebrow">Reference styles</p>
            <h2>The visual anchors currently in the base</h2>
          </div>
          <div className="ref-grid">
            {(snapshot?.referenceStyles || []).map((ref) => (
              <article className="ref-card" key={ref.id}>
                {ref.imageUrl ? <img src={ref.imageUrl} alt={ref.name} /> : null}
                <div>
                  <strong>{ref.name}</strong>
                  <p>{ref.role} · {ref.mediaWorld}</p>
                  <small>{ref.keywords}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
