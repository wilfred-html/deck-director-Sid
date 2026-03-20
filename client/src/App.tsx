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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

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
  const stageRef = useRef<HTMLElement | null>(null);

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

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
        body: JSON.stringify({ versionId: selectedVersion }),
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
    if (next) setSelectedGeneratedId(next.id);
  }

  async function toggleFullscreen() {
    if (!stageRef.current) return;

    if (document.fullscreenElement === stageRef.current) {
      await document.exitFullscreen();
      return;
    }

    await stageRef.current.requestFullscreen();
  }

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
              <button onClick={handleGenerate} disabled={!selectedVersion || generating}>{generating ? 'Generating with Nano Banana 2…' : 'Generate Slides'}</button>
              <span className="status-pill">{busy ? 'Compiling prompt package…' : generating ? 'Generating + writing back to Airtable…' : 'AI-ready from Airtable'}</span>
            </div>
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
              <button onClick={() => moveSelected(-1)} disabled={!selectedGeneratedSlide || !presentation || presentation.generatedSlides[0]?.id === selectedGeneratedSlide.id}>Previous</button>
              <button onClick={() => moveSelected(1)} disabled={!selectedGeneratedSlide || !presentation || presentation.generatedSlides[presentation.generatedSlides.length - 1]?.id === selectedGeneratedSlide.id}>Next</button>
              <button onClick={toggleFullscreen} disabled={!selectedGeneratedSlide}>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</button>
            </div>
          </div>

          <div className="viewer-grid">
            <aside className="filmstrip">
              {(presentation?.generatedSlides || []).map((slide) => (
                <button
                  key={slide.id}
                  className={`thumb-card ${slide.id === selectedGeneratedId ? 'active' : ''}`}
                  onClick={() => setSelectedGeneratedId(slide.id)}
                >
                  {slide.previewImageUrl ? <img src={slide.previewImageUrl} alt={slide.name} /> : <div className="thumb-placeholder">No preview</div>}
                  <div className="thumb-meta">
                    <strong>{slide.slideNumber || '—'}</strong>
                    <span>{slide.status}</span>
                  </div>
                </button>
              ))}
            </aside>

            <section className={`presentation-stage ${isFullscreen ? 'is-fullscreen' : ''}`} ref={stageRef}>
              <div className="stage-topline">
                <div>
                  <p className="eyebrow">Slide focus</p>
                  <h3>{selectedGeneratedSlide?.name || 'No generated slide selected'}</h3>
                </div>
                {selectedGeneratedSlide ? <span className="stage-counter">Slide {selectedGeneratedSlide.slideNumber}</span> : null}
              </div>

              <div className="stage-canvas-wrap">
                {selectedGeneratedSlide?.previewImageUrl ? (
                  <img className="stage-canvas" src={selectedGeneratedSlide.previewImageUrl} alt={selectedGeneratedSlide.name} />
                ) : (
                  <div className="stage-empty">Generate a version to start viewing the presentation.</div>
                )}
              </div>
            </section>

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

        <section className="principles">
          <div>
            <p className="eyebrow">Generation system</p>
            <h2>The rules driving Nano Banana 2</h2>
          </div>
          <ul className="plain-list">
            <li><strong>Layout:</strong> {spec?.designFormulaSystem.layout.primarySplit}</li>
            <li><strong>Typography:</strong> modular scales {(spec?.designFormulaSystem.typography.modularScale || []).join(' / ')}</li>
            <li><strong>Spacing:</strong> {spec?.designFormulaSystem.spacing.rhythm} → {(spec?.designFormulaSystem.spacing.steps || []).join(', ')}</li>
            <li><strong>Performance:</strong> {spec?.designFormulaSystem.performance.contextWindow}</li>
          </ul>
        </section>

        <section className="schema-table-wrap">
          <h3 className="inline-title">Generation plan</h3>
          <table className="schema-table">
            <thead>
              <tr>
                <th>Slide</th>
                <th>Title</th>
                <th>Template</th>
                <th>Rolling context</th>
                <th>References</th>
              </tr>
            </thead>
            <tbody>
              {(compiled?.compiledSlides || []).map((slide) => (
                <tr key={slide.slideNumber}>
                  <td>{slide.slideNumber}</td>
                  <td>{slide.title}</td>
                  <td><code>{slide.targetTemplate}</code></td>
                  <td>{slide.rollingContext.map((item) => item.slide_number).join(' → ')}</td>
                  <td>{(slide.linkedReferences || []).map((ref) => ref.name).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

export default App;
