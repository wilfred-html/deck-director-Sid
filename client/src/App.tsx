import { useMemo, useState } from 'react';
import './App.css';

type Slide = {
  slideNumber: number;
  imageUrl: string;
  wordCount: number;
  lineCount: number;
  headingLength: number;
  densityScore: number;
  layoutScore: number;
  visualScore: number;
  consistencyScore: number;
  driftReasons: string[];
  template: 'hero' | 'divider' | 'text-image' | 'framework' | 'concept-grid' | 'summary';
  recommendation: 'keep' | 'light-cleanup' | 'rebuild';
  redesignPlan: {
    sourceIntent: string;
    targetTemplateId: string;
    confidence: number;
    actions: Array<{ type: string; reason: string }>;
    mediaDecisions: Array<{ action: string; reason: string }>;
    notes: string[];
  };
};

type AuditResult = {
  auditId: string;
  originalName: string;
  pageCount: number;
  averageScore: number;
  summary: { keep: number; lightCleanup: number; rebuild: number };
  principles: string[];
  slides: Slide[];
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Slide['recommendation']>('all');

  const filteredSlides = useMemo(() => {
    if (!audit) return [];
    return filter === 'all' ? audit.slides : audit.slides.filter((slide) => slide.recommendation === filter);
  }, [audit, filter]);

  async function handleAudit() {
    if (!file) return;
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.append('deck', file);

    try {
      const response = await fetch(`${API_BASE}/api/audits`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Audit failed');
      setAudit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Deck Director</p>
          <h1>Audit presentation consistency before the deck turns into a Frankenstein.</h1>
          <p className="lede">
            Upload a PDF deck, inspect slide drift, rank rebuild candidates, and turn a messy presentation into a deliberate system.
          </p>
          <div className="hero-actions">
            <label className="upload-card">
              <span>{file ? file.name : 'Choose PDF deck'}</span>
              <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <button disabled={!file || busy} onClick={handleAudit}>
              {busy ? 'Auditing…' : 'Run consistency audit'}
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
          <ul className="principle-strip">
            <li>Template mapping</li>
            <li>Drift scoring</li>
            <li>Rebuild prioritization</li>
          </ul>
        </div>
        <div className="hero-panel">
          <div className="hero-stat"><span>Upload</span><strong>PDF decks up to 200MB</strong></div>
          <div className="hero-stat"><span>MVP scope</span><strong>Audit first, auto-redesign next</strong></div>
          <div className="hero-stat"><span>Output</span><strong>Heatmap + slide recommendations</strong></div>
        </div>
      </header>

      {audit ? (
        <main className="dashboard">
          <section className="summary-grid">
            <article>
              <span>Deck</span>
              <strong>{audit.originalName}</strong>
              <small>{audit.pageCount} slides audited</small>
            </article>
            <article>
              <span>Average consistency</span>
              <strong>{audit.averageScore}%</strong>
              <small>rule-based MVP score</small>
            </article>
            <article>
              <span>Rebuild</span>
              <strong>{audit.summary.rebuild}</strong>
              <small>high-priority outliers</small>
            </article>
            <article>
              <span>Light cleanup</span>
              <strong>{audit.summary.lightCleanup}</strong>
              <small>needs normalization</small>
            </article>
          </section>

          <section className="principles">
            <div>
              <p className="eyebrow">Audit principles</p>
              <h2>What the engine is optimizing for</h2>
            </div>
            <ol>
              {audit.principles.map((principle) => (
                <li key={principle}>{principle}</li>
              ))}
            </ol>
          </section>

          <section className="toolbar">
            <div>
              <p className="eyebrow">Slide review</p>
              <h2>Outliers, cleanup candidates, and keepers</h2>
            </div>
            <div className="filters">
              {['all', 'rebuild', 'light-cleanup', 'keep'].map((value) => (
                <button
                  key={value}
                  className={filter === value ? 'active' : ''}
                  onClick={() => setFilter(value as typeof filter)}
                >
                  {value}
                </button>
              ))}
            </div>
          </section>

          <section className="slides-grid">
            {filteredSlides.map((slide) => (
              <article className="slide-card" key={slide.slideNumber}>
                <img src={`${API_BASE}${slide.imageUrl}`} alt={`Slide ${slide.slideNumber}`} loading="lazy" />
                <div className="slide-body">
                  <div className="slide-topline">
                    <p>Slide {slide.slideNumber}</p>
                    <span className={`badge ${slide.recommendation}`}>{slide.recommendation.replace('-', ' ')}</span>
                  </div>
                  <h3>{slide.template.replace('-', ' ')}</h3>
                  <div className="score-row">
                    <span>Consistency</span>
                    <strong>{slide.consistencyScore}%</strong>
                  </div>
                  <div className="metrics">
                    <span>Words {slide.wordCount}</span>
                    <span>Lines {slide.lineCount}</span>
                    <span>Heading {slide.headingLength}</span>
                  </div>
                  <ul>
                    {slide.driftReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <div className="plan-box">
                    <p className="plan-kicker">Redesign target</p>
                    <strong>{slide.redesignPlan.targetTemplateId}</strong>
                    <span className="plan-confidence">confidence {Math.round(slide.redesignPlan.confidence * 100)}%</span>
                    <ul className="plan-actions">
                      {slide.redesignPlan.actions.slice(0, 3).map((action) => (
                        <li key={`${slide.slideNumber}-${action.type}`}>{action.reason}</li>
                      ))}
                    </ul>
                    {slide.redesignPlan.mediaDecisions[0] ? (
                      <p className="media-note">Media: {slide.redesignPlan.mediaDecisions[0].reason}</p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </section>
        </main>
      ) : (
        <section className="empty-state">
          <p className="eyebrow">Why this exists</p>
          <h2>The problem is not making slides. It’s keeping 80 of them visually coherent under pressure.</h2>
          <p>
            This MVP starts with audit and prioritization: score consistency, classify slide archetypes, and identify which slides need a light cleanup versus a full rebuild.
          </p>
        </section>
      )}
    </div>
  );
}

export default App;
