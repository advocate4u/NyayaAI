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
const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

function optionalHttpUrl(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { throw new Error(label + ' must be a valid http(s) URL.'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(label + ' must use http:// or https://.');
  }
  return parsed.href;
}

function optionalDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const candidate = value.trim();
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(candidate) || Number.isNaN(Date.parse(candidate)) ||
      new Date(candidate).toISOString().slice(0, 10) !== candidate) {
    throw new Error(label + ' must be a valid date in YYYY-MM-DD format.');
  }
  return candidate;
}

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
  relevanceScore: number;
  snippet: string;
  citation?: string;
  sectionHeading?: string;
  sourceUrl?: string;
};

export async function parseLegalFile(
  file: File,
  metadata: {
    sourceUrl?: string;
    sourceDate?: string;
    ocrLanguage?: 'eng' | 'eng+hin';
    onProgress?: (message: string) => void;
  } = {}
): Promise<OfflineLegalDocument[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('This file is larger than 50 MB. Split large legal libraries into smaller files and import them separately.');
  const safeSourceUrl = optionalHttpUrl(metadata.sourceUrl, 'Source URL');
  const safeSourceDate = optionalDate(metadata.sourceDate, 'Source-check date');
  const importedAt = new Date().toISOString();

  if (file.name.toLowerCase().endsWith('.pdf')) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const pageContent = await page.getTextContent();
      const pageText = pageContent.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim();
      pages.push(pageText);
    }

    const scannedPages = pages.map((pageText, index) => pageText ? -1 : index).filter((index) => index >= 0);
    if (scannedPages.length) {
      metadata.onProgress?.('Scanned page(s) detected. Loading OCR language data; first use may need internet…');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(metadata.ocrLanguage ?? 'eng');
      try {
        for (const pageIndex of scannedPages) {
          metadata.onProgress?.('Recognising scanned page ' + (pageIndex + 1) + ' of ' + pdf.numPages + '…');
          const page = await pdf.getPage(pageIndex + 1);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Could not prepare a canvas for PDF OCR.');
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const recognition = await worker.recognize(canvas);
          pages[pageIndex] = recognition.data.text.replace(/\s+/g, ' ').trim();
          canvas.width = 0;
          canvas.height = 0;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown OCR error';
        throw new Error('OCR could not read this scanned PDF (' + reason + '). Try a clearer scan or import while connected so OCR language data can be cached.');
      } finally {
        await worker.terminate();
      }
    }

    const text = pages.filter(Boolean).join('\n\n').trim();
    if (!text) throw new Error('No text could be extracted. Try a clearer scan or a different OCR language.');
    return [{
      id: 'import-' + Date.now() + '-' + file.size,
      title: file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '),
      actYear: '',
      sourceUrl: safeSourceUrl,
      sourceDate: safeSourceDate,
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
        const sectionSourceUrl = optionalHttpUrl(item.sourceUrl, 'Provision ' + (sectionIndex + 1) + ' source URL');
        return { citation, heading, text: sectionText, ...(sectionSourceUrl ? { sourceUrl: sectionSourceUrl } : {}) };
      });
      const suppliedText = typeof value.text === 'string' ? value.text.trim() : '';
      const text = suppliedText || sections.map((section) => `${section.citation}: ${section.heading}\n${section.text}`).join('\n\n');
      if (!title || !text) throw new Error('Each JSON document needs a title and either non-empty "text" or a "sections" array.');
      return {
        id: typeof value.id === 'string' && value.id.trim() ? value.id : `import-${Date.now()}-${index}`,
        title,
        actYear: typeof value.actYear === 'string' || typeof value.actYear === 'number' ? String(value.actYear) : '',
        sourceUrl: optionalHttpUrl(value.sourceUrl || safeSourceUrl, 'Document source URL'),
        sourceDate: optionalDate(value.sourceDate || safeSourceDate, 'Document source-check date'),
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
    sourceUrl: metadata.sourceUrl?.trim() ?? '',
    sourceDate: metadata.sourceDate?.trim() ?? '',
    text,
    importedAt
  }];
}

export function searchOfflineDocuments(documents: OfflineLegalDocument[], query: string): OfflineSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const stopWords = new Set(['what', 'does', 'the', 'is', 'are', 'how', 'can', 'i', 'my', 'about', 'under', 'explain', 'please', 'tell', 'me', 'this', 'that', 'for', 'of', 'and', 'to', 'in', 'on', 'with', 'as', 'at', 'a', 'an', 'it', 'law', 'legal', 'section', 'article', 'rule', 'क्या', 'है', 'के', 'की', 'का', 'में', 'और', 'कैसे', 'बताएं', 'मुझे']);
  const terms = normalizedQuery.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1 && !stopWords.has(term));
  if (!terms.length) return [];
  const results: OfflineSearchResult[] = [];
  const countOccurrences = (text: string, term: string) => {
    let count = 0;
    let from = 0;
    while (count < 4) {
      const index = text.indexOf(term, from);
      if (index < 0) break;
      count += 1;
      from = index + term.length;
    }
    return count;
  };

  for (const document of documents) {
    const titleMatch = document.title.toLocaleLowerCase().includes(normalizedQuery);
    if (document.sections?.length) {
      for (const section of document.sections) {
        const lower = section.text.toLocaleLowerCase();
        const heading = section.heading.toLocaleLowerCase();
        const citationText = section.citation.toLocaleLowerCase();
        const titleText = document.title.toLocaleLowerCase();
        const matchedTerms = terms.filter((term) => lower.includes(term) || heading.includes(term) || citationText.includes(term) || titleText.includes(term));
        if (!matchedTerms.length && !titleMatch) continue;
        const relevanceScore = matchedTerms.reduce((score, term) =>
          score + countOccurrences(lower, term) + (heading.includes(term) ? 3 : 0) +
          (citationText.includes(term) ? 4 : 0) + (titleText.includes(term) ? 5 : 0), 0) +
          (normalizedQuery && (titleText.includes(normalizedQuery) || citationText.includes(normalizedQuery)) ? 8 : 0);
        const firstIndex = matchedTerms.length ? lower.indexOf(matchedTerms[0]) : 0;
        const start = Math.max(0, firstIndex - 140);
        const end = Math.min(section.text.length, firstIndex + 260);
        results.push({
          document,
          matchedTerms: matchedTerms.length,
          relevanceScore,
          snippet: section.text.slice(start, end).replace(/\s+/g, ' ').trim(),
          citation: section.citation,
          sectionHeading: section.heading,
          sourceUrl: section.sourceUrl || document.sourceUrl
        });
      }
      continue;
    }

    const lower = document.text.toLocaleLowerCase();
    const titleText = document.title.toLocaleLowerCase();
    const matchedTerms = terms.filter((term) => lower.includes(term) || titleText.includes(term));
    if (!titleMatch && !matchedTerms.length) continue;
    const relevanceScore = matchedTerms.reduce((score, term) =>
      score + countOccurrences(lower, term) + (titleText.includes(term) ? 5 : 0), 0) +
      (normalizedQuery && titleText.includes(normalizedQuery) ? 8 : 0);
    const firstIndex = matchedTerms.length ? lower.indexOf(matchedTerms[0]) : 0;
    const start = Math.max(0, firstIndex - 140);
    const end = Math.min(document.text.length, firstIndex + 260);
    results.push({
      document,
      matchedTerms: matchedTerms.length,
      relevanceScore,
      snippet: document.text.slice(start, end).replace(/\s+/g, ' ').trim(),
      sourceUrl: document.sourceUrl
    });
  }
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore || b.matchedTerms - a.matchedTerms);
}
