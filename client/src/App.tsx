import { useEffect, useMemo, useState } from 'react';
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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function App() {
  const [spec, setSpec] = useState<CompilerSpec | null>(null);
  const [snapshot, setSnapshot] = useState<AirtableSnapshot | null>(null);
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const selectedDeck = useMemo(() => {
    if (!snapshot || !selectedVersion) return null;
    const version = snapshot.versions.find((item) => item.id === selectedVersion);
    return snapshot.decks.find((deck) => version?.deckIds.includes(deck.id)) || null;
  }, [snapshot, selectedVersion]);

  return (
    <div className="shell compiler-shell">
      <header className="hero compiler-hero">
        <div className="hero-copy">
          <p className="eyebrow">Deck Director / Airtable-first</p>
          <h1>Compile decks directly from Airtable.</h1>
          <p className="lede">The platform is now wired to the Deck Director base: versions, slide rows, and reference styles are fetched from Airtable and compiled into slide plans inside the app.</p>
          <ul className="principle-strip">
            <li>Decks from Airtable</li>
            <li>References with images</li>
            <li>Rolling-context compilation</li>
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
          <article><span>Reference Styles</span><strong>{snapshot?.referenceStyles.length || 0}</strong><small>linked visual anchors</small></article>
        </section>

        <section className="principles">
          <div>
            <p className="eyebrow">Compiler control</p>
            <h2>Select the Airtable version to compile</h2>
          </div>
          <div>
            <div className="control-row">
              <select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
                {(snapshot?.versions || []).map((version) => (
                  <option key={version.id} value={version.id}>{version.name} · {version.status}</option>
                ))}
              </select>
              <span className="status-pill">{busy ? 'Compiling…' : 'Live from Airtable'}</span>
            </div>
            <p className="media-note">{selectedDeck?.description || spec?.summary}</p>
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
            <p className="eyebrow">Design formulas</p>
            <h2>The math driving the compile</h2>
          </div>
          <ul className="plain-list">
            <li><strong>Layout:</strong> {spec?.designFormulaSystem.layout.primarySplit}</li>
            <li><strong>Typography:</strong> modular scales {(spec?.designFormulaSystem.typography.modularScale || []).join(' / ')}</li>
            <li><strong>Spacing:</strong> {spec?.designFormulaSystem.spacing.rhythm} → {(spec?.designFormulaSystem.spacing.steps || []).join(', ')}</li>
            <li><strong>Performance:</strong> {spec?.designFormulaSystem.performance.contextWindow}</li>
          </ul>
        </section>

        <section className="schema-table-wrap">
          <h3 className="inline-title">Compiled slide plan</h3>
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
