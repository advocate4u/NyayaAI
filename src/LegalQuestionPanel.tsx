import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { createLocalLegalEngine, type LocalLegalEngine } from './localAi';
import { BookOpen, ClipboardList, Copy, Info, Search } from 'lucide-react';
import { listOfflineDocuments, searchOfflineDocuments, type OfflineLegalDocument, type OfflineSearchResult } from './legalStore';

export default function LegalQuestionPanel() {
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [documents, setDocuments] = useState<OfflineLegalDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<LocalLegalEngine | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelProgress, setModelProgress] = useState('');
  const [generating, setGenerating] = useState(false);
  const [modelAnswer, setModelAnswer] = useState('');

  const results = useMemo<OfflineSearchResult[]>(
    () => submittedQuestion ? searchOfflineDocuments(documents, submittedQuestion).slice(0, 8) : [],
    [documents, submittedQuestion]
  );

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      setMessage('Enter a legal question first.');
      return;
    }
    setBusy(true);
    setMessage('');
    setModelAnswer('');
    try {
      const library = await listOfflineDocuments();
      setDocuments(library);
      setLoaded(true);
      setSubmittedQuestion(trimmed);
      if (!library.length) setMessage('Your offline library is empty. Import verified legal text in the Offline legal library section first.');
    } catch {
      setMessage('Could not read the local legal library in this browser.');
    } finally {
      setBusy(false);
    }
  }


  async function loadModel() {
    setModelBusy(true);
    setModelProgress('Checking browser compatibility…');
    try {
      const localEngine = await createLocalLegalEngine(setModelProgress);
      setEngine(localEngine);
      setModelProgress('Ready: ' + localEngine.modelId + '. Model files are cached in this browser when supported.');
    } catch (error) {
      setModelProgress(error instanceof Error ? error.message : 'Could not load the local AI model.');
    } finally {
      setModelBusy(false);
    }
  }

  async function generateLocalAnswer() {
    if (!engine || !submittedQuestion || !results.length) {
      setModelProgress('Search for a question with matching imported legal passages first.');
      return;
    }
    setGenerating(true);
    setModelAnswer('');
    setModelProgress('Generating an answer on this device…');
    try {
      const evidence = results.map((result, index) => [
        '[' + (index + 1) + '] ' + result.document.title + (result.citation ? ' — ' + result.citation : '') + (result.sectionHeading ? ' — ' + result.sectionHeading : ''),
        'Source URL: ' + (result.sourceUrl || result.document.sourceUrl || 'Not supplied'),
        'Verification date: ' + (result.document.sourceDate || 'Not supplied'),
        'Passage: ' + result.snippet
      ].join('\\n')).join('\\n\\n');
      const answer = await engine.answer(submittedQuestion, evidence);
      setModelAnswer(answer);
      setModelProgress('Generated locally using ' + engine.modelId + '. Verify all cited passages against the current official source.');
    } catch (error) {
      setModelProgress(error instanceof Error ? error.message : 'Local generation failed. Use the cited passages directly.');
    } finally {
      setGenerating(false);
    }
  }

  function copyCitedContext() {
    const context = [
      'NyayaAI — evidence pack for a legal research question',
      'Question: ' + submittedQuestion,
      '',
      'Instructions for a future AI model: use only the source passages below; cite each legal proposition; do not invent missing provisions or cases; state when the evidence is insufficient; remind the reader to verify current law and amendments.',
      '',
      ...results.flatMap((result, index) => [
        '[' + (index + 1) + '] ' + result.document.title + (result.citation ? ' — ' + result.citation : '') + (result.sectionHeading ? ' — ' + result.sectionHeading : ''),
        'Source URL: ' + (result.sourceUrl || result.document.sourceUrl || 'Not supplied'),
        'Verified date: ' + (result.document.sourceDate || 'Not supplied'),
        result.snippet,
        ''
      ])
    ].join('\n');
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(context)
        .then(() => setMessage('Cited evidence pack copied to the clipboard.'))
        .catch(() => setMessage('Clipboard access was blocked. You can still copy the cited passages shown above.'));
    } else {
      setMessage('Clipboard access is not available in this browser. You can still copy the cited passages shown above.');
    }
  }

  return (
    <section className="content-section question-panel-section">
      <div className="section-heading">
        <div><span className="section-kicker">NEXT: SOURCE-GROUNDED Q&A</span><h2>Ask NyayaAI</h2></div>
        <span className="result-count">Offline research</span>
      </div>
      <div className="question-panel-card">
        <div className="question-panel-note"><Info size={17} /><span>This milestone retrieves matching provisions from your local library. It does not generate an AI legal opinion yet; the on-device model will be integrated separately.</span></div>
        <form onSubmit={(event) => { void askQuestion(event); }} className="question-form">
          <label htmlFor="nyaya-question">Ask a legal question</label>
          <textarea id="nyaya-question" rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Example: What does my imported text say about bail or limitation?" />
          <button className="primary-button" type="submit" disabled={busy}><Search size={16} /> {busy ? 'Searching local sources…' : 'Find cited provisions'}</button>
        </form>
        {message && <p className="library-message" role="status">{message}</p>}
        {submittedQuestion && <div className="question-results">
          <div className="question-results-heading"><div><span className="section-kicker">RETRIEVED EVIDENCE</span><h3>{results.length} matching passage{results.length === 1 ? '' : 's'}</h3></div>{results.length > 0 && <button className="save-button" onClick={copyCitedContext}><Copy size={14} /> Copy evidence pack</button>}</div>
          {results.map((result, index) => <article className="evidence-card" key={result.document.id + '-' + (result.citation ?? 'document') + '-' + index}>
            <div className="evidence-card-title"><span className="evidence-number">{index + 1}</span><div><strong>{result.document.title}</strong><span>{result.citation ? result.citation : 'Document match'}{result.sectionHeading ? ' — ' + result.sectionHeading : ''}</span></div></div>
            <p>{result.snippet}</p>
            <div className="evidence-source"><span>Verified date: {result.document.sourceDate || 'not supplied'}</span>{(result.sourceUrl || result.document.sourceUrl) && <a href={result.sourceUrl || result.document.sourceUrl} target="_blank" rel="noreferrer">Open source</a>}</div>
          </article>)}
          {results.length === 0 && loaded && <div className="empty-state"><BookOpen size={24} /><h3>No matching provision found</h3><p>Try different wording or import the relevant official legal text. No legal conclusion is inferred from an empty result.</p></div>}
        </div>}

        <div className="local-ai-controls">
          <div className="local-ai-heading"><strong><span className="section-kicker">ON-DEVICE AI</span><br />Optional local model</strong><span className="local-ai-status">{engine ? 'Loaded' : 'Not loaded'}</span></div>
          <p>The model is downloaded only after you press the button. The first download requires internet and may use hundreds of MB of storage; after caching, generation may work offline. WebGPU and available memory vary by phone/browser.</p>
          {!engine && <button className="primary-button" type="button" disabled={modelBusy} onClick={() => { void loadModel(); }}>{modelBusy ? 'Loading model…' : 'Load local AI model'}</button>}
          {engine && submittedQuestion && results.length > 0 && <button className="primary-button" type="button" disabled={generating} onClick={() => { void generateLocalAnswer(); }}>{generating ? 'Generating locally…' : 'Generate answer from cited passages'}</button>}
          {modelProgress && <p className="model-progress" role="status">{modelProgress}</p>}
        </div>
        {modelAnswer && <article className="ai-answer">
          <div className="ai-answer-title"><strong>Local AI response</strong><span>{engine?.modelId}</span></div>
          <p className="ai-answer-warning">Review the citations and source text before relying on this generated answer. Imported documents are not independently verified.</p>
          <div className="ai-answer-text">{modelAnswer}</div>
        </article>}

        <div className="question-panel-footer"><ClipboardList size={15} /><span>Source-first design: answers should be grounded in the imported text and cite the exact provision. AI synthesis is the next stage.</span></div>
      </div>
    </section>
  );
}
