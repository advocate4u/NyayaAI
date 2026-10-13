import { useMemo, useState } from 'react';
import { BookOpen, ClipboardList, Copy, Info, Search } from 'lucide-react';
import { listOfflineDocuments, searchOfflineDocuments, type OfflineLegalDocument, type OfflineSearchResult } from './legalStore';

export default function LegalQuestionPanel() {
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [documents, setDocuments] = useState<OfflineLegalDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const results = useMemo<OfflineSearchResult[]>(
    () => submittedQuestion ? searchOfflineDocuments(documents, submittedQuestion).slice(0, 8) : [],
    [documents, submittedQuestion]
  );

  async function askQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      setMessage('Enter a legal question first.');
      return;
    }
    setBusy(true);
    setMessage('');
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
    void navigator.clipboard?.writeText(context);
    setMessage('Evidence pack prepared for copying. If clipboard access is blocked, select and copy the displayed source passages.');
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
        <div className="question-panel-footer"><ClipboardList size={15} /><span>Source-first design: answers should be grounded in the imported text and cite the exact provision. AI synthesis is the next stage.</span></div>
      </div>
    </section>
  );
}
