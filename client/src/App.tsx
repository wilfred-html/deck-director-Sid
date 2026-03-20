import { useEffect, useState } from 'react';
import './App.css';

type SchemaField = {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example?: string;
};

type CompilerStage = {
  name: string;
  description: string;
};

type FormulaSystem = {
  layout: {
    primarySplit: string;
    fallbackSplits: string[];
    grid: string;
    rule: string;
  };
  typography: {
    modularScale: string[];
    hierarchy: string;
    lineLength: string;
    densityRule: string;
  };
  spacing: {
    rhythm: string;
    steps: number[];
    rule: string;
  };
  performance: {
    generationMode: string;
    contextWindow: string;
    reason: string;
    batchingRule: string;
  };
};

type CompilerSpec = {
  productDirection: string;
  summary: string;
  rollingWindowRule: {
    strategy: string;
    currentRow: string;
    lookbackRows: number;
    examples: string[];
    note: string;
  };
  deckRowSchema: SchemaField[];
  compilerStages: CompilerStage[];
  designFormulaSystem: FormulaSystem;
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
  rollingContext: Array<{
    slide_number: string;
    title: string;
    section: string;
    intent: string;
    layout_type: string;
  }>;
};

type IngestResult = {
  rowCount: number;
  validRowCount: number;
  invalidRows: Array<{ rowNumber: number; missing: string[]; valid: boolean }>;
  compiledSlides: CompiledSlide[];
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

const sampleRows = [
  {
    slide_number: 1,
    section: 'Opening',
    intent: 'cover',
    layout_type: 'hero',
    title: 'SAFA x Standard Bank',
    body: 'A premium football partnership deck that feels cinematic, credible, and modern.',
    media_type: 'real',
    emphasis: 'image-led',
  },
  {
    slide_number: 2,
    section: 'Context',
    intent: 'narrative',
    layout_type: 'text-image-7-5',
    title: 'Why football culture matters here',
    body: 'The partnership works because it meets real passion, identity, and routine — not abstract sponsorship logic.',
    media_type: 'real',
    emphasis: 'balanced',
  },
  {
    slide_number: 3,
    section: 'Framework',
    intent: 'framework',
    layout_type: 'framework-3-card',
    title: 'Three strategic pillars',
    bullets: 'Reach the mass audience | Build emotional connection | Create repeatable activation moments',
    media_type: 'none',
    emphasis: 'text-led',
  },
];

function App() {
  const [spec, setSpec] = useState<CompilerSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [ingest, setIngest] = useState<IngestResult | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/compiler/spec`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load compiler spec');
        setSpec(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load compiler spec'));
  }, []);

  async function handleIngest() {
    if (!sheet) return;
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.append('sheet', sheet);

    try {
      const response = await fetch(`${API_BASE}/api/compiler/ingest`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to ingest sheet');
      setIngest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest sheet');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell compiler-shell">
      <header className="hero compiler-hero">
        <div className="hero-copy">
          <p className="eyebrow">Deck Director / Rehaul</p>
          <h1>Build decks from rows, not from chaos.</h1>
          <p className="lede">
            Deck Director is being re-hauled into a row-driven deck compiler: spreadsheet in, locked design system in the middle, coherent slide sequence out.
          </p>
          <div className="hero-actions">
            <label className="upload-card">
              <span>{sheet ? sheet.name : 'Choose CSV / XLSX / XLS'}</span>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setSheet(e.target.files?.[0] || null)} />
            </label>
            <button disabled={!sheet || busy} onClick={handleIngest}>{busy ? 'Compiling…' : 'Ingest sheet'}</button>
          </div>
          <ul className="principle-strip">
            <li>CSV / Excel source of truth</li>
            <li>Rolling local context</li>
            <li>Fixed global design memory</li>
          </ul>
        </div>
        <div className="hero-panel">
          <div className="hero-stat"><span>Direction</span><strong>Spreadsheet-driven slide generation</strong></div>
          <div className="hero-stat"><span>Context rule</span><strong>Current row + previous two rows</strong></div>
          <div className="hero-stat"><span>Design math</span><strong>Golden-ratio guidance + modular scales + 8pt rhythm</strong></div>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <main className="dashboard">
        <section className="principles compiler-summary">
          <div>
            <p className="eyebrow">Core shift</p>
            <h2>From audit platform to deck compiler</h2>
          </div>
          <p>{spec?.summary || 'Loading compiler direction…'}</p>
        </section>

        <section className="summary-grid compiler-grid">
          <article>
            <span>Input model</span>
            <strong>1 row = 1 slide</strong>
            <small>explicit content, intent, and layout type</small>
          </article>
          <article>
            <span>Generation rule</span>
            <strong>{spec?.rollingWindowRule.lookbackRows ?? 2} row lookback</strong>
            <small>local continuity without full-deck token bloat</small>
          </article>
          <article>
            <span>Media policy</span>
            <strong>Mixed-controlled</strong>
            <small>real + AI can coexist if treatment stays coherent</small>
          </article>
          <article>
            <span>Output goal</span>
            <strong>Compiler + renderer</strong>
            <small>not just scoring, actual slide construction</small>
          </article>
        </section>

        <section className="principles">
          <div>
            <p className="eyebrow">Rolling context</p>
            <h2>The local-memory rule</h2>
          </div>
          <div>
            <ul className="plain-list">
              {(spec?.rollingWindowRule.examples || []).map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
            <p className="media-note">{spec?.rollingWindowRule.note}</p>
          </div>
        </section>

        <section className="principles">
          <div>
            <p className="eyebrow">Design formulas</p>
            <h2>The math behind the compiler</h2>
          </div>
          <div>
            <ul className="plain-list">
              <li><strong>Layout:</strong> {spec?.designFormulaSystem.layout.primarySplit}</li>
              <li><strong>Fallbacks:</strong> {(spec?.designFormulaSystem.layout.fallbackSplits || []).join(' · ')}</li>
              <li><strong>Grid:</strong> {spec?.designFormulaSystem.layout.grid}</li>
              <li><strong>Typography:</strong> modular scales {(spec?.designFormulaSystem.typography.modularScale || []).join(' / ')}</li>
              <li><strong>Spacing:</strong> {spec?.designFormulaSystem.spacing.rhythm} → {(spec?.designFormulaSystem.spacing.steps || []).join(', ')}</li>
              <li><strong>Performance:</strong> {spec?.designFormulaSystem.performance.reason}</li>
            </ul>
          </div>
        </section>

        <section className="principles">
          <div>
            <p className="eyebrow">Compiler stages</p>
            <h2>The new pipeline</h2>
          </div>
          <ol>
            {(spec?.compilerStages || []).map((stage) => (
              <li key={stage.name}><strong>{stage.name}:</strong> {stage.description}</li>
            ))}
          </ol>
        </section>

        <section className="toolbar schema-toolbar">
          <div>
            <p className="eyebrow">Deck row schema</p>
            <h2>The spreadsheet contract</h2>
          </div>
        </section>

        <section className="schema-table-wrap">
          <table className="schema-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Required</th>
                <th>Description</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              {(spec?.deckRowSchema || []).map((field) => (
                <tr key={field.key}>
                  <td><code>{field.key}</code></td>
                  <td>{field.required ? 'Yes' : 'No'}</td>
                  <td>{field.description}</td>
                  <td>{field.example || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="principles">
          <div>
            <p className="eyebrow">Sample rows</p>
            <h2>What the compiler will ingest</h2>
          </div>
          <div className="code-panel">
            <pre>{JSON.stringify(sampleRows, null, 2)}</pre>
          </div>
        </section>

        {ingest ? (
          <>
            <section className="summary-grid compiler-grid">
              <article>
                <span>Rows loaded</span>
                <strong>{ingest.rowCount}</strong>
                <small>records parsed from your sheet</small>
              </article>
              <article>
                <span>Valid rows</span>
                <strong>{ingest.validRowCount}</strong>
                <small>rows ready for compilation</small>
              </article>
              <article>
                <span>Invalid rows</span>
                <strong>{ingest.invalidRows.length}</strong>
                <small>rows missing required fields</small>
              </article>
              <article>
                <span>Compiled slides</span>
                <strong>{ingest.compiledSlides.length}</strong>
                <small>slide plans created</small>
              </article>
            </section>

            <section className="schema-table-wrap">
              <h3 className="inline-title">Compiled slide preview</h3>
              <table className="schema-table">
                <thead>
                  <tr>
                    <th>Slide</th>
                    <th>Template</th>
                    <th>Title</th>
                    <th>Rolling context</th>
                  </tr>
                </thead>
                <tbody>
                  {ingest.compiledSlides.slice(0, 12).map((slide) => (
                    <tr key={slide.slideNumber}>
                      <td>{slide.slideNumber}</td>
                      <td><code>{slide.targetTemplate}</code></td>
                      <td>{slide.title}</td>
                      <td>{slide.rollingContext.map((item) => item.slide_number).join(' → ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default App;
