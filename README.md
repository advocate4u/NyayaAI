# NyayaAI

**Free, mobile-first Indian legal research assistant — designed for offline use.**

NyayaAI aims to help people explore Indian legislation and legal materials in plain English and Hindi, with citations to underlying sources. The project prioritizes source transparency, privacy, and offline-first functionality.

## Project principles

- Free to use and built with free/open-source tooling.
- Mobile-first and installable on Android.
- Offline legal text search before offline generative AI.
- Source-grounded answers with Act, section, date, and source metadata.
- No mandatory account, paid AI API, or cloud backend for core features.
- Legal information is for research and education; generated content must be verified against authoritative sources.

## Planned architecture

- **Web UI:** React + TypeScript + Vite.
- **Install/offline shell:** Progressive Web App (PWA) and service worker.
- **Offline legal library:** IndexedDB in the browser prototype; SQLite in a later native Android implementation.
- **Search:** local full-text search over downloaded legal text.
- **AI (later milestone):** optional on-device language model with retrieval-augmented generation (RAG).
- **Optional API (later):** ASP.NET Core for opt-in updates and synchronization; not required for offline use.

## Roadmap

1. Responsive app shell and legal search experience.
2. PWA installation and offline app shell.
3. Section-aware legal document ingestion with source URLs and update dates.
4. Source-grounded offline question retrieval over imported legal text (implemented); AI answer synthesis from cited passages.
5. Android on-device model integration and offline tests.
6. Hindi/English quality, security, and legal accuracy evaluation.

## Development

Requirements: Node.js LTS and npm.

```bash
npm install
npm run dev
```

Build and test the production bundle:

```bash
npm run build
npm run preview
```

## Legal data and accuracy

Only ingest materials from sources whose access and reuse terms permit the intended use. Prefer official government and court sources, retain source URLs and retrieval dates, and verify amendments and commencement dates. Do not present generated output as a substitute for checking the governing law or case record.

## Status

Early scaffold. No legal corpus or generative AI model is bundled yet. Offline search and on-device AI will be added in later milestones.

## Importing legal text for offline search

The current app can extract selectable text from `.pdf` files and import `.txt` or structured `.json` files. Scanned/image-only PDFs require OCR, which is not included yet. Imported data is stored in the browser's IndexedDB on the current device and is not uploaded. You can attach an official source URL and the date you verified the text to PDF/TXT imports. JSON can contain a full-text document or section-level chunks:

```json
{
  "title": "Example Act, 2024",
  "actYear": "2024",
  "sourceUrl": "https://official-source.example/act",
  "sourceDate": "2026-10-13",
  "sections": [
    {
      "citation": "Section 1",
      "heading": "Title and commencement",
      "text": "Paste the verified text of this section here.",
      "sourceUrl": "https://official-source.example/act#section-1"
    }
  ]
}
```

The example above is a schema example, not legal content. Preserve the actual official source URL and the date you verified the text. Section citations are only as reliable as the imported data.


## Current question-answering status

The Ask NyayaAI panel currently performs **offline evidence retrieval**, not generative AI. It returns matching imported provisions with their citation labels, source URLs and verification dates, and can copy a cited evidence pack. The next AI milestone is to run a small on-device model against this retrieved context, with strict instructions to cite sources and abstain when evidence is insufficient.
