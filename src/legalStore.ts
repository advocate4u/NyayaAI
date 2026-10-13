import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type LegalSection = {
  citation: string;
  heading: string;
  text: string;
  sourceUrl?: string;
};

export type OfflineLegalDocument = {
  id: string;
  title: string;
  actYear: string;
  sourceUrl: string;
  sourceDate: string;
  text: string;
  sections?: LegalSection[];
  importedAt: string;
};

const DB_NAME = 'nyayaai-legal-library';
const STORE_NAME = 'documents';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support local document storage.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local legal library.'));
  });
}

export async function listOfflineDocuments(): Promise<OfflineLegalDocument[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => { const documents = (request.result as OfflineLegalDocument[]).sort((a, b) => a.title.localeCompare(b.title)); db.close(); resolve(documents); };
    request.onerror = () => { db.close(); reject(request.error ?? new Error('Could not read the local legal library.')); };
  });
}

export async function saveOfflineDocument(document: OfflineLegalDocument): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(document);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Could not save the document.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Document save was cancelled.')); };
  });
}

export async function deleteOfflineDocument(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Could not delete the document.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Document deletion was cancelled.')); };
  });
}

export type OfflineSearchResult = {
  document: OfflineLegalDocument;
  matchedTerms: number;
  snippet: string;
  citation?: string;
  sectionHeading?: string;
  sourceUrl?: string;
};

export async function parseLegalFile(
  file: File,
  metadata: { sourceUrl?: string; sourceDate?: string } = {}
): Promise<OfflineLegalDocument[]> {
  const importedAt = new Date().toISOString();

  if (file.name.toLowerCase().endsWith('.pdf')) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const pageContent = await page.getTextContent();
      const pageText = pageContent.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\\s+/g, ' ').trim();
      if (pageText) pages.push(pageText);
    }
    const text = pages.join('\\n\\n').trim();
    if (!text) throw new Error('No selectable text was found in this PDF. It may be scanned; OCR support is not available yet.');
    return [{
      id: `import-${Date.now()}-${file.size}`,
      title: file.name.replace(/\\.pdf$/i, '').replace(/[_-]+/g, ' '),
      actYear: '',
      sourceUrl: metadata.sourceUrl?.trim() ?? '',
      sourceDate: metadata.sourceDate?.trim() ?? '',
      text,
      importedAt
    }];
  }

  const raw = await file.text();
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed: unknown = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map((entry, index) => {
      if (!entry || typeof entry !== 'object') throw new Error('Each JSON document must be an object.');
      const value = entry as Record<string, unknown>;
      const title = typeof value.title === 'string' ? value.title.trim() : '';
      const sectionsRaw = Array.isArray(value.sections) ? value.sections : [];
      const sections = sectionsRaw.map((section, sectionIndex) => {
        if (!section || typeof section !== 'object') throw new Error('Each section must be an object.');
        const item = section as Record<string, unknown>;
        const citation = typeof item.citation === 'string' || typeof item.citation === 'number' ? String(item.citation).trim() : (typeof item.sectionNumber === 'string' || typeof item.sectionNumber === 'number' ? 'Section ' + String(item.sectionNumber).trim() : '');
        const heading = typeof item.heading === 'string' ? item.heading.trim() : '';
        const sectionText = typeof item.text === 'string' ? item.text.trim() : '';
        if (!citation || !sectionText) throw new Error(`Provision ${sectionIndex + 1} needs "citation" (or "sectionNumber") and "text".`);
        return { citation, heading, text: sectionText, ...(typeof item.sourceUrl === 'string' ? { sourceUrl: item.sourceUrl } : {}) };
      });
      const suppliedText = typeof value.text === 'string' ? value.text.trim() : '';
      const text = suppliedText || sections.map((section) => `${section.citation}: ${section.heading}\n${section.text}`).join('\n\n');
      if (!title || !text) throw new Error('Each JSON document needs a title and either non-empty "text" or a "sections" array.');
      return {
        id: typeof value.id === 'string' && value.id.trim() ? value.id : `import-${Date.now()}-${index}`,
        title,
        actYear: typeof value.actYear === 'string' || typeof value.actYear === 'number' ? String(value.actYear) : '',
        sourceUrl: typeof value.sourceUrl === 'string' && value.sourceUrl.trim() ? value.sourceUrl.trim() : (metadata.sourceUrl?.trim() ?? ''),
        sourceDate: typeof value.sourceDate === 'string' && value.sourceDate.trim() ? value.sourceDate.trim() : (metadata.sourceDate?.trim() ?? ''),
        text,
        sections,
        importedAt
      };
    });
  }
  if (!file.name.toLowerCase().endsWith('.txt')) {
    throw new Error('Choose a .pdf, .txt or .json file.');
  }
  const text = raw.trim();
  if (!text) throw new Error('The selected text file is empty.');
  return [{
    id: `import-${Date.now()}-${file.size}`,
    title: file.name.replace(/\.txt$/i, '').replace(/[_-]+/g, ' '),
    actYear: '',
    sourceUrl: '',
    sourceDate: '',
    text,
    importedAt
  }];
}

export function searchOfflineDocuments(documents: OfflineLegalDocument[], query: string): OfflineSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const results: OfflineSearchResult[] = [];

  for (const document of documents) {
    const titleMatch = document.title.toLocaleLowerCase().includes(normalizedQuery);
    if (document.sections?.length) {
      for (const section of document.sections) {
        const lower = section.text.toLocaleLowerCase();
        const matchedTerms = terms.filter((term) => lower.includes(term));
        if (!matchedTerms.length && !titleMatch) continue;
        const firstIndex = matchedTerms.length ? lower.indexOf(matchedTerms[0]) : 0;
        const start = Math.max(0, firstIndex - 140);
        const end = Math.min(section.text.length, firstIndex + 260);
        results.push({
          document,
          matchedTerms: matchedTerms.length,
          snippet: section.text.slice(start, end).replace(/\s+/g, ' ').trim(),
          citation: section.citation,
          sectionHeading: section.heading,
          sourceUrl: section.sourceUrl || document.sourceUrl
        });
      }
      continue;
    }

    const lower = document.text.toLocaleLowerCase();
    const matchedTerms = terms.filter((term) => lower.includes(term));
    if (!titleMatch && !matchedTerms.length) continue;
    const firstIndex = matchedTerms.length ? lower.indexOf(matchedTerms[0]) : 0;
    const start = Math.max(0, firstIndex - 140);
    const end = Math.min(document.text.length, firstIndex + 260);
    results.push({
      document,
      matchedTerms: matchedTerms.length,
      snippet: document.text.slice(start, end).replace(/\s+/g, ' ').trim(),
      sourceUrl: document.sourceUrl
    });
  }
  return results.sort((a, b) => b.matchedTerms - a.matchedTerms);
}
