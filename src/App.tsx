import { useMemo, useState } from 'react';
import OfflineLibrary from './OfflineLibrary';
import LegalQuestionPanel from './LegalQuestionPanel';
import {
  ArrowDownToLine, BookOpen, CheckCircle2, ChevronRight, FileText,
  Languages, Search, ShieldCheck, Wifi, WifiOff, X, PenLine, UserRound, Copy, ClipboardList
} from 'lucide-react';

type AdvocateProfile = {
  name: string;
  qualification: string;
  courts: string;
  office: string;
  phone: string;
  email: string;
  signature: string;
};

const defaultProfile: AdvocateProfile = {
  name: 'Anit Mittal',
  qualification: 'Advocate | B.Tech, LL.B.',
  courts: 'Punjab & Haryana High Court; District & Sessions Court, Karnal; Sub-Divisional Court, Gharaunda',
  office: '1st Floor, Doctor Mittal Clinic, New Grain Market Road, Gharaunda',
  phone: '',
  email: '',
  signature: 'Anit Mittal'
};

type LegalSource = {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  summary: string;
  keywords: string[];
  url: string;
  language: string;
};

const sources: LegalSource[] = [
  {
    id: 'constitution',
    title: 'Constitution of India',
    shortTitle: 'Constitution',
    category: 'Constitutional law',
    summary: 'The constitutional framework of India, including fundamental rights, institutions and governance.',
    keywords: ['constitution', 'fundamental rights', 'article', 'writ', 'equality', 'liberty', 'संविधान', 'मौलिक अधिकार'],
    url: 'https://www.indiacode.nic.in/',
    language: 'English'
  },
  {
    id: 'bns',
    title: 'Bharatiya Nyaya Sanhita, 2023',
    shortTitle: 'BNS, 2023',
    category: 'Criminal law',
    summary: 'India’s principal criminal offences statute, subject to applicable commencement provisions and amendments.',
    keywords: ['bns', 'criminal law', 'offence', 'theft', 'assault', 'murder', 'भारतीय न्याय संहिता', 'अपराध'],
    url: 'https://www.indiacode.nic.in/',
    language: 'English'
  },
  {
    id: 'bnss',
    title: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    shortTitle: 'BNSS, 2023',
    category: 'Criminal procedure',
    summary: 'Criminal procedure framework; check the relevant date, exceptions and transitional provisions.',
    keywords: ['bnss', 'bail', 'arrest', 'fir', 'investigation', 'criminal procedure', 'जमानत', 'गिरफ्तारी', 'एफआईआर'],
    url: 'https://www.indiacode.nic.in/',
    language: 'English'
  },
  {
    id: 'bsa',
    title: 'Bharatiya Sakshya Adhiniyam, 2023',
    shortTitle: 'BSA, 2023',
    category: 'Evidence law',
    summary: 'Evidence law, including rules relevant to documentary and electronic evidence.',
    keywords: ['bsa', 'evidence', 'electronic evidence', 'document', 'admissibility', 'साक्ष्य', 'इलेक्ट्रॉनिक साक्ष्य'],
    url: 'https://www.indiacode.nic.in/',
    language: 'English'
  },
  {
    id: 'cpc',
    title: 'Code of Civil Procedure, 1908',
    shortTitle: 'CPC, 1908',
    category: 'Civil procedure',
    summary: 'Procedural framework for civil suits, pleadings, interim relief and execution, subject to amendments and local rules.',
    keywords: ['cpc', 'civil suit', 'injunction', 'plaint', 'execution', 'दीवानी', 'स्थगन आदेश'],
    url: 'https://www.indiacode.nic.in/',
    language: 'English'
  },
  {
    id: 'contract',
    title: 'Indian Contract Act, 1872',
    shortTitle: 'Contract Act',
    category: 'Contract law',
    summary: 'Core statutory framework for contracts, including agreement, consideration and contractual obligations.',
    keywords: ['contract', 'agreement', 'consideration', 'breach', 'damages', 'अनुबंध', 'समझौता'],
    url: 'https://www.indiacode.nic.in/',
    language: 'English'
  },
  {
    id: 'consumer',
    title: 'Consumer Protection Act, 2019',
    shortTitle: 'Consumer Protection',
    category: 'Consumer law',
    summary: 'Consumer rights and statutory mechanisms for addressing consumer disputes.',
    keywords: ['consumer', 'deficiency', 'product liability', 'refund', 'unfair trade', 'उपभोक्ता', 'सेवा में कमी'],
    url: 'https://www.indiacode.nic.in/',
    language: 'English'
  },
  {
    id: 'ni-act',
    title: 'Negotiable Instruments Act, 1881',
    shortTitle: 'NI Act',
    category: 'Commercial law',
    summary: 'Includes statutory provisions concerning negotiable instruments and cheque dishonour.',
    keywords: ['negotiable instruments', 'cheque', 'section 138', 'dishonour', 'चेक बाउंस', 'धारा 138'],
    url: 'https://www.indiacode.nic.in/',
    language: 'English'
  }
];

const quickQuestions = [
  { label: 'Bail & arrest', query: 'bail arrest BNSS जमानत' },
  { label: 'Fundamental rights', query: 'fundamental rights Constitution मौलिक अधिकार' },
  { label: 'Cheque dishonour', query: 'section 138 cheque dishonour चेक बाउंस' },
  { label: 'Consumer complaint', query: 'consumer deficiency refund उपभोक्ता' }
];

export default function App() {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<'English' | 'हिन्दी'>('English');
  const [showOfflineInfo, setShowOfflineInfo] = useState(false);
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nyayaai-saved') ?? '[]') as string[]; }
    catch { return []; }
  });
  const [online] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [profile, setProfile] = useState<AdvocateProfile>(() => {
    try {
      return { ...defaultProfile, ...(JSON.parse(localStorage.getItem('nyayaai-profile') ?? '{}') as Partial<AdvocateProfile>) };
    } catch { return defaultProfile; }
  });
  const [draftType, setDraftType] = useState('Legal notice');
  const [draftFacts, setDraftFacts] = useState('');
  const [draftOutput, setDraftOutput] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return sources;
    const terms = normalized.split(/\s+/).filter(Boolean);
    return sources.filter((source) => {
      const searchable = [source.title, source.shortTitle, source.category, source.summary, ...source.keywords]
        .join(' ').toLocaleLowerCase();
      return terms.some((term) => searchable.includes(term));
    });
  }, [query]);

  function toggleSaved(id: string) {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem('nyayaai-saved', JSON.stringify(next));
      return next;
    });
  }

  const savedSources = sources.filter((source) => saved.includes(source.id));

  function updateProfile(field: keyof AdvocateProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    setProfileSaved(false);
  }

  function saveProfile() {
    localStorage.setItem('nyayaai-profile', JSON.stringify(profile));
    setProfileSaved(true);
  }

  function createDraft() {
    const facts = draftFacts.trim();
    if (!facts) {
      setDraftOutput('Please enter the facts or purpose before creating a draft.');
      return;
    }
    const lines = [
      draftType.toUpperCase(),
      '',
      '[DRAFT — VERIFY ALL FACTS, APPLICABLE LAW, DATES AND PROCEDURAL REQUIREMENTS BEFORE USE]',
      '',
      'To / Before: [Enter recipient, authority or court]',
      'Subject: [Enter concise subject]',
      '',
      'Respected Sir/Madam,',
      '',
      'The relevant facts and request, as supplied by the user, are set out below:',
      facts,
      '',
      '[Insert the applicable legal provisions, grounds, limitation details, supporting documents and specific relief sought after verification.]',
      '',
      'It is therefore respectfully requested that the appropriate relief be considered in accordance with law.',
      '',
      'Place: [Enter place]',
      'Date: [Enter date]',
      '',
      'Signature: __________________________',
      profile.signature || profile.name,
      profile.qualification,
      profile.courts,
      profile.office,
      profile.phone ? 'Phone: ' + profile.phone : '',
      profile.email ? 'Email: ' + profile.email : '',
      '',
      'This is a general drafting template, not a verified pleading or legal opinion.'
    ].filter((line) => line !== undefined);
    setDraftOutput(lines.join('\n'));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="NyayaAI home">
          <span className="brand-mark"><BookOpen size={21} /></span>
          <span><strong>NyayaAI</strong><small>Indian law, made clear</small></span>
        </a>
        <div className="topbar-actions"><button className="language-toggle" onClick={() => setLanguage((current) => current === 'English' ? 'हिन्दी' : 'English')} aria-label="Switch language">{language === 'English' ? 'हिन्दी' : 'EN'}</button><button className="icon-button" onClick={() => setShowOfflineInfo(true)} aria-label="Offline mode information">
          {online ? <Wifi size={19} /> : <WifiOff size={19} />}
        </button></div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="pulse" /> FREE • PRIVATE • OFFLINE-FIRST</div>
        <h1>{language === 'English' ? <>Understand the law.<br /><em>Know your rights.</em></> : <>कानून को समझें।<br /><em>अपने अधिकार जानें।</em></>}</h1>
        <p>{language === 'English'
          ? 'Search Indian Acts and legal topics in plain language. Built to keep your research close to you.'
          : 'भारतीय कानून और कानूनी विषयों को सरल भाषा में खोजें। आपकी रिसर्च, आपके डिवाइस पर।'}</p>
        <div className="hero-meta">
          <span><ShieldCheck size={15} /> Source-first research</span>
          <span><WifiOff size={15} /> Offline-ready shell</span>
        </div>
      </section>

      <section className="search-panel" aria-label="Search legal sources">
        <label htmlFor="legal-search">What would you like to understand?</label>
        <div className="search-box">
          <Search size={20} />
          <input id="legal-search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “bail”, “Article 21”, “चेक बाउंस”…" />
          {query && <button className="clear-button" onClick={() => setQuery('')} aria-label="Clear search"><X size={17} /></button>}
        </div>
        <div className="quick-searches">
          {quickQuestions.map((item) => <button key={item.label} onClick={() => setQuery(item.query)}>{item.label}<ChevronRight size={14} /></button>)}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div><span className="section-kicker">LEGAL LIBRARY</span><h2>{query ? 'Search results' : 'Explore Indian law'}</h2></div>
          <span className="result-count">{results.length} sources</span>
        </div>
        <div className="source-list">
          {results.map((source) => (
            <article className="source-card" key={source.id}>
              <div className="source-icon"><FileText size={21} /></div>
              <div className="source-body">
                <span className="category">{source.category}</span>
                <h3>{source.title}</h3>
                <p>{source.summary}</p>
                <div className="source-actions">
                  <a href={source.url} target="_blank" rel="noreferrer">Find official text <ChevronRight size={15} /></a>
                  <button onClick={() => toggleSaved(source.id)} className={saved.includes(source.id) ? 'save-button saved' : 'save-button'}>
                    {saved.includes(source.id) ? <CheckCircle2 size={15} /> : <ArrowDownToLine size={15} />}
                    {saved.includes(source.id) ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </article>
          ))}
          {results.length === 0 && <div className="empty-state"><Search size={28} /><h3>No matching source yet</h3><p>Try a legal topic, Act name or a shorter keyword in English or Hindi.</p></div>}
        </div>
      </section>

      {savedSources.length > 0 && <section className="content-section saved-section">
        <div className="section-heading"><div><span className="section-kicker">ON THIS DEVICE</span><h2>Saved sources</h2></div><span className="result-count">{savedSources.length} saved</span></div>
        <div className="saved-chips">{savedSources.map((source) => <button key={source.id} onClick={() => setQuery(source.shortTitle)}>{source.shortTitle}</button>)}</div>
      </section>}


      <OfflineLibrary query={query} />
      <LegalQuestionPanel />

      <section className="content-section profile-section">
        <div className="section-heading">
          <div><span className="section-kicker">YOUR WORKSPACE</span><h2>Advocate details & signature</h2></div>
          <UserRound size={22} color="#26796e" />
        </div>
        <div className="profile-card">
          <p className="profile-intro">These details are saved only in this browser on this device and can be inserted into draft templates. Edit them before use.</p>
          <div className="profile-grid">
            <label>Full name<input value={profile.name} onChange={(e) => updateProfile('name', e.target.value)} /></label>
            <label>Qualification / designation<input value={profile.qualification} onChange={(e) => updateProfile('qualification', e.target.value)} /></label>
            <label className="wide-field">Courts / practice locations<textarea rows={2} value={profile.courts} onChange={(e) => updateProfile('courts', e.target.value)} /></label>
            <label className="wide-field">Office address<textarea rows={2} value={profile.office} onChange={(e) => updateProfile('office', e.target.value)} /></label>
            <label>Phone (optional)<input value={profile.phone} onChange={(e) => updateProfile('phone', e.target.value)} placeholder="Add if you want it on drafts" /></label>
            <label>Email (optional)<input value={profile.email} onChange={(e) => updateProfile('email', e.target.value)} placeholder="Add if you want it on drafts" /></label>
            <label className="wide-field">Typed signature name<input value={profile.signature} onChange={(e) => updateProfile('signature', e.target.value)} /></label>
          </div>
          <div className="profile-footer"><span>{profileSaved ? <><CheckCircle2 size={15} /> Saved on this device</> : 'Not saved yet'}</span><button className="primary-button save-profile" onClick={saveProfile}>Save details</button></div>
        </div>
      </section>

      <section className="content-section draft-section">
        <div className="section-heading">
          <div><span className="section-kicker">DRAFTING TOOLS</span><h2>Start a legal draft</h2></div>
          <PenLine size={22} color="#26796e" />
        </div>
        <div className="draft-card">
          <div className="draft-note"><ClipboardList size={17} /><span>Creates a structured starter template only. It does not research or insert verified legal provisions.</span></div>
          <label className="draft-label">Document type
            <select value={draftType} onChange={(e) => setDraftType(e.target.value)}>
              <option>Legal notice</option><option>Application</option><option>Affidavit</option><option>Representation</option><option>Case summary</option>
            </select>
          </label>
          <label className="draft-label">Facts and purpose
            <textarea rows={5} value={draftFacts} onChange={(e) => setDraftFacts(e.target.value)} placeholder="Enter the facts, dates, parties and relief requested. Avoid unnecessary sensitive personal data." />
          </label>
          <button className="primary-button" onClick={createDraft}>Create draft template</button>
          {draftOutput && <div className="draft-output">
            <div className="output-heading"><strong>Draft preview</strong><button className="save-button" onClick={() => { void navigator.clipboard?.writeText(draftOutput); }}><Copy size={14} /> Copy text</button></div>
            <pre>{draftOutput}</pre>
          </div>}
        </div>
      </section>
\n      <section className="assistant-teaser">
        <div className="assistant-icon"><Languages size={23} /></div>
        <div><span className="section-kicker">NEXT DEVELOPMENT STAGE</span><h2>On-device AI model</h2><p>Offline evidence retrieval is now available. Next, connect a small local language model that drafts answers only from retrieved, cited legal passages.</p></div>
        <span className="coming-soon">Planned</span>
      </section>

      <footer className="footer">
        <div className="footer-brand"><BookOpen size={17} /><strong>NyayaAI</strong><span>v0.1 foundation</span></div>
        <p>For legal research and education only. Verify the current law, amendments, local rules and case record before relying on any information.</p>
        <a href="https://www.indiacode.nic.in/" target="_blank" rel="noreferrer">Official legislation portal <ChevronRight size={14} /></a>
      </footer>

      {showOfflineInfo && <div className="modal-backdrop" role="presentation" onClick={() => setShowOfflineInfo(false)}>
        <section className="info-modal" role="dialog" aria-modal="true" aria-labelledby="offline-title" onClick={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowOfflineInfo(false)} aria-label="Close"><X size={19} /></button>
          <div className="modal-icon"><WifiOff size={24} /></div>
          <h2 id="offline-title">Built for offline use</h2>
          <p>The app shell is configured for install and offline caching. This first milestone contains a small built-in index, not the full text of Acts or an AI model.</p>
          <ul><li>Search the bundled index after the app has loaded.</li><li>Saved items stay in this browser on this device.</li><li>Official source links require internet access.</li><li>Downloading verified legal text and on-device AI are next milestones.</li></ul>
          <button className="primary-button" onClick={() => setShowOfflineInfo(false)}>Understood</button>
        </section>
      </div>}
    </main>
  );
}