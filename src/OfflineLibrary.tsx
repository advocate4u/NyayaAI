import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ChevronRight, FileText, X } from 'lucide-react';
import { deleteOfflineDocument, listOfflineDocuments, parseLegalFile, saveOfflineDocument, searchOfflineDocuments, type OfflineLegalDocument } from './legalStore';

type Props = { query: string };

export default function OfflineLibrary({ query }: Props) {
  const [documents, setDocuments] = useState<OfflineLegalDocument[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = useMemo(() => searchOfflineDocuments(documents, query), [documents, query]);

  useEffect(() => {
    void listOfflineDocuments().then(setDocuments).catch(() => {
      setMessage('Local document storage is not available in this browser.');
    });
  }, []);

  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const parsed = await parseLegalFile(file);
      for (const document of parsed) await saveOfflineDocument(document);
      setDocuments(await listOfflineDocuments());
      setMessage(`Imported ${parsed.length} document${parsed.length === 1 ? '' : 's'} to this device.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import the selected file.');
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(id: string) {
    try {
      await deleteOfflineDocument(id);
      setDocuments(await listOfflineDocuments());
      setMessage('Document removed from this device.');
    } catch {
      setMessage('Could not remove the selected document.');
    }
  }

  return (
    <section className="content-section offline-library-section">
      <div className="section-heading">
        <div><span className="section-kicker">ON-DEVICE KNOWLEDGE BASE</span><h2>Offline legal library</h2></div>
        <span className="result-count">{documents.length} imported</span>
      </div>
      <div className="library-card">
        <p className="profile-intro">Import legal text obtained from an authoritative source. Files stay in this browser on this device; nothing is uploaded. This version supports plain text and JSON, not PDFs yet.</p>
        <label className="file-picker">
          <ArrowDownToLine size={18} />
          <span>{busy ? 'Importing document…' : 'Import .txt or .json'}</span>
          <input type="file" accept=".txt,.json,text/plain,application/json" disabled={busy} onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        </label>
        <details className="json-help">
          <summary>JSON format for structured legal text</summary>
          <pre>{'{\n  "title": "Example Act, 2024",\n  "actYear": "2024",\n  "sourceUrl": "https://official-source.example/act",\n  "sourceDate": "2026-10-13",\n  "text": "Paste verified legal text here..."\n}'}</pre>
        </details>
        {message && <p className="library-message" role="status">{message}</p>}
      </div>
      {documents.length > 0 && <div className="offline-doc-list">
        {documents.map((document) => {
          const match = matches.find((item) => item.document.id === document.id);
          return <article className="offline-doc-card" key={document.id}>
            <div className="offline-doc-top">
              <div className="source-icon"><FileText size={19} /></div>
              <div className="offline-doc-title"><h3>{document.title}</h3><span>{document.actYear ? 'Year: ' + document.actYear + ' · ' : ''}Imported {new Date(document.importedAt).toLocaleDateString()}</span></div>
              <button className="remove-doc" onClick={() => { void removeDocument(document.id); }} aria-label={'Remove ' + document.title}><X size={16} /></button>
            </div>
            {query.trim() && match && <p className="offline-snippet">{match.snippet}{match.snippet.length >= 400 ? '…' : ''}</p>}
            {query.trim() && !match && <p className="offline-snippet muted-snippet">No match for the current search.</p>}
            <div className="offline-doc-bottom">
              {document.sourceUrl ? <a href={document.sourceUrl} target="_blank" rel="noreferrer">Open source <ChevronRight size={14} /></a> : <span>Source URL not supplied</span>}
              <span>{document.text.length.toLocaleString()} characters</span>
            </div>
          </article>;
        })}
      </div>}
      <p className="legal-data-warning">Imported text is not independently verified by NyayaAI. Preserve the official source and date, and check amendments and commencement before relying on it.</p>
    </section>
  );
}
