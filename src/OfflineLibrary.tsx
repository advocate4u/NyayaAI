import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ChevronRight, Download, FileText, X } from 'lucide-react';
import { deleteOfflineDocument, listOfflineDocuments, parseLegalFile, saveOfflineDocument, searchOfflineDocuments, type OfflineLegalDocument } from './legalStore';

type Props = { query: string };

const OFFICIAL_SOURCES = [
  { name: 'India Code', purpose: 'Central Acts and legislation', url: 'https://www.indiacode.nic.in/' },
  { name: 'Legislative Department', purpose: 'Constitution and legislative materials', url: 'https://legislative.gov.in/' },
  { name: 'e-Gazette of India', purpose: 'Gazette notifications and commencement notices', url: 'https://egazette.gov.in/' },
  { name: 'Supreme Court of India', purpose: 'Supreme Court judgments and orders', url: 'https://www.sci.gov.in/' },
  { name: 'eCourts Services', purpose: 'Court services and judgment search', url: 'https://ecourts.gov.in/' }
];

const JSON_IMPORT_TEMPLATE = {
  title: 'Enter the exact Act / Rules / Judgment title',
  actYear: 'Enter enactment or decision year',
  sourceUrl: 'https://paste-the-official-source-url-here',
  sourceDate: new Date().toISOString().slice(0, 10),
  sections: [
    {
      citation: 'Section 1 / Article 1 / paragraph 1',
      heading: 'Exact official heading',
      text: 'Paste the exact provision or paragraph from the official source. Preserve wording and punctuation.',
      sourceUrl: 'https://paste-the-direct-official-provision-url-here',
      sourceDate: new Date().toISOString().slice(0, 10)
    }
  ]
};

type OfficialSource = typeof OFFICIAL_SOURCES[number];

export default function OfflineLibrary({ query }: Props) {
  const [documents, setDocuments] = useState<OfflineLegalDocument[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceDate, setSourceDate] = useState('');
  const [ocrLanguage, setOcrLanguage] = useState<'eng' | 'eng+hin'>('eng+hin');
  const matches = useMemo(() => searchOfflineDocuments(documents, query), [documents, query]);
  const visibleDocuments = useMemo(() => query.trim() ? documents.filter((document) => matches.some((match) => match.document.id === document.id)) : documents, [documents, matches, query]);

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
      const parsed = await parseLegalFile(file, { sourceUrl, sourceDate, ocrLanguage, onProgress: setMessage });
      const existing = await listOfflineDocuments();
      const seen = new Set(existing.map((document) => {
        const title = document.title.trim().toLocaleLowerCase();
        const source = document.sourceUrl.trim().toLocaleLowerCase();
        return source ? title + '|url|' + source : title + '|text|' + document.text.trim().toLocaleLowerCase();
      }));
      const existingIds = new Set(existing.map((document) => document.id));
      let added = 0;
      let skipped = 0;
      for (const document of parsed) {
        const title = document.title.trim().toLocaleLowerCase();
        const source = document.sourceUrl.trim().toLocaleLowerCase();
        const fingerprint = source ? title + '|url|' + source : title + '|text|' + document.text.trim().toLocaleLowerCase();
        if (seen.has(fingerprint)) { skipped += 1; continue; }
        if (existingIds.has(document.id)) {
          document.id = 'import-' + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
        }
        await saveOfflineDocument(document);
        existingIds.add(document.id);
        seen.add(fingerprint);
        added += 1;
      }
      setDocuments(await listOfflineDocuments());
      setMessage(`Imported ${added} document${added === 1 ? '' : 's'}; skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}. Existing documents were preserved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import the selected file.');
    } finally {
      setBusy(false);
    }
  }

  function downloadJsonTemplate() {
    const payload = JSON.stringify(JSON_IMPORT_TEMPLATE, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nyayaai-section-import-template.json';
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Section-level JSON template downloaded. Replace every example field with text and URLs checked against the official source before importing.');
  }

  async function exportBackup() {
    if (!documents.length) {
      setMessage('There are no offline documents to export yet.');
      return;
    }
    const filename = 'nyayaai-legal-library-' + new Date().toISOString().slice(0, 10) + '.json';
    const payload = JSON.stringify(documents, null, 2);
    const file = new File([payload], filename, { type: 'application/json' });
    try {
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'NyayaAI offline legal library backup' });
        setMessage('Backup shared. Keep a copy somewhere safe; it contains your imported legal documents.');
        return;
      }
      const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Backup export started. Keep the JSON file somewhere safe; it contains your imported legal documents.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setMessage('Backup sharing was cancelled.');
      } else {
        setMessage('Could not export the backup in this browser. Try opening NyayaAI in Chrome.');
      }
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
        <div className="library-heading-actions"><span className="result-count">{documents.length} imported</span><button className="save-button" type="button" disabled={!documents.length} onClick={() => { void exportBackup(); }}><Download size={14} /> Export backup</button></div>
      </div>
      <div className="library-card">
        <p className="profile-intro">Import a PDF, .txt file or structured .json file from an authoritative source. Selectable PDF text is extracted directly; scanned PDF pages use on-device OCR. Files stay in this browser on this device; nothing is uploaded. JSON backups can be restored here. Duplicate documents are skipped to protect existing entries. Files over 50 MB are rejected; split large collections before importing. OCR language data may need a one-time internet download and can use significant memory on long PDFs.</p>
        <div className="official-source-panel">
          <div className="official-source-heading"><h3>Official Indian-law source directory</h3><button className="save-button" type="button" onClick={downloadJsonTemplate}><Download size={14} /> Section JSON template</button></div>
          <p>Open an official portal, locate the exact Act, rule, notification or judgment, then import a downloaded copy or paste its verified text into the section template. NyayaAI does not automatically crawl these sites or confirm that a document is current.</p>
          <div className="official-source-grid">
            {OFFICIAL_SOURCES.map((source: OfficialSource) => <a key={source.name} className="official-source-link" href={source.url} target="_blank" rel="noreferrer">
              <strong>{source.name}<ChevronRight size={13} /></strong><span>{source.purpose}</span><small>{new URL(source.url).hostname}</small>
            </a>)}
          </div>
        </div>
        <div className="import-metadata">
          <label>Official source URL (optional)<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://official-source.gov.in/…" /></label>
          <label>Source checked on (optional)<input type="date" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} /></label>
          <label>OCR language for scanned PDFs<select value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value as 'eng' | 'eng+hin')}><option value="eng+hin">English + Hindi</option><option value="eng">English only</option></select></label>
        </div>
        <label className="file-picker">
          <ArrowDownToLine size={18} />
          <span>{busy ? 'Importing document…' : 'Import / restore PDF, TXT or JSON backup'}</span>
          <input type="file" accept=".pdf,.txt,.json,application/pdf,text/plain,application/json" disabled={busy} onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        </label>
        <details className="json-help">
          <summary>JSON format for structured legal text</summary>
          <pre>{JSON.stringify(JSON_IMPORT_TEMPLATE, null, 2)}</pre>
        </details>
        {message && <p className="library-message" role="status">{message}</p>}
      </div>
      {visibleDocuments.length > 0 && <div className="offline-doc-list">
        {visibleDocuments.map((document) => {
          const documentMatches = matches.filter((item) => item.document.id === document.id);
          return <article className="offline-doc-card" key={document.id}>
            <div className="offline-doc-top">
              <div className="source-icon"><FileText size={19} /></div>
              <div className="offline-doc-title"><h3>{document.title}</h3><span>{document.actYear ? 'Year: ' + document.actYear + ' · ' : ''}Imported {new Date(document.importedAt).toLocaleDateString()}</span></div>
              <button className="remove-doc" onClick={() => { void removeDocument(document.id); }} aria-label={'Remove ' + document.title}><X size={16} /></button>
            </div>
            {query.trim() && documentMatches.map((match, index) => <div className="offline-match" key={document.id + '-' + (match.citation ?? 'document') + '-' + index}>
              <div className="offline-match-citation"><strong>{match.citation || document.title}{match.sectionHeading ? ' — ' + match.sectionHeading : ''}</strong>{(match.sourceUrl || document.sourceUrl) && <a href={match.sourceUrl || document.sourceUrl} target="_blank" rel="noreferrer">Source <ChevronRight size={13} /></a>}</div>
              <p className="offline-snippet">{match.snippet}{match.snippet.length >= 400 ? '…' : ''}</p>
              <span className="offline-match-date">Provision source checked: {match.sourceDate || 'date not supplied'} · user-entered metadata, not independent verification</span>
            </div>)}
            <div className="offline-doc-bottom">
              {document.sourceUrl ? <a href={document.sourceUrl} target="_blank" rel="noreferrer">Open source <ChevronRight size={14} /></a> : <span>Source URL not supplied</span>}
              <span>{document.text.length.toLocaleString()} characters</span>
            </div>
          </article>;
        })}
      </div>}
      {query.trim() && documents.length > 0 && visibleDocuments.length === 0 && <div className="empty-state library-empty"><FileText size={24} /><h3>No offline document matches</h3><p>Try a shorter keyword or import the relevant official legal text.</p></div>}
      <p className="legal-data-warning">Imported text is not independently verified by NyayaAI. Preserve the official source and date, and check amendments and commencement before relying on it.</p>
    </section>
  );
}
