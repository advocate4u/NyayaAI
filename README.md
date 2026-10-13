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
3. Legal document ingestion with provenance and update dates.
4. Citation-grounded question answering.
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