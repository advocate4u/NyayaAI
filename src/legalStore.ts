export type OfflineLegalDocument = {
  id: string;
  title: string;
  actYear: string;
  sourceUrl: string;
  sourceDate: string;
  text: string;
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

export async function parseLegalFile(file: File): Promise<OfflineLegalDocument[]> {
  const raw = await file.text();
  const importedAt = new Date().toISOString();
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed: unknown = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map((entry, index) => {
      if (!entry || typeof entry !== 'object') throw new Error('Each JSON document must be an object.');
      const value = entry as Record<string, unknown>;
      const title = typeof value.title === 'string' ? value.title.trim() : '';
      const text = typeof value.text === 'string' ? value.text.trim() : '';
      if (!title || !text) throw new Error('Each JSON document needs non-empty "title" and "text" fields.');
      return {
        id: typeof value.id === 'string' && value.id.trim() ? value.id : `import-${Date.now()}-${index}`,
        title,
        actYear: typeof value.actYear === 'string' || typeof value.actYear === 'number' ? String(value.actYear) : '',
        sourceUrl: typeof value.sourceUrl === 'string' ? value.sourceUrl : '',
        sourceDate: typeof value.sourceDate === 'string' ? value.sourceDate : '',
        text,
        importedAt
      };
    });
  }
  if (!file.name.toLowerCase().endsWith('.txt')) {
    throw new Error('For this milestone, import .txt or .json files. PDF support will be added later.');
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

export function searchOfflineDocuments(documents: OfflineLegalDocument[], query: string) {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return documents.flatMap((document) => {
    const lower = document.text.toLocaleLowerCase();
    const titleMatch = document.title.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    const matches = terms.filter((term) => lower.includes(term));
    if (!titleMatch && matches.length === 0) return [];
    const firstIndex = matches.length ? lower.indexOf(matches[0]) : 0;
    const start = Math.max(0, firstIndex - 140);
    const end = Math.min(document.text.length, firstIndex + 260);
    return [{
      document,
      matchedTerms: matches.length,
      snippet: document.text.slice(start, end).replace(/\s+/g, ' ').trim()
    }];
  }).sort((a, b) => b.matchedTerms - a.matchedTerms);
}
