'use client';

import React, { useState, useEffect, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

type Movie = { index: number; title: string; genres: string; score?: number };

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [liked, setLiked] = useState<Movie[]>([]);
  const [recs, setRecs] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}&limit=8`);
        const data = await r.json();
        setResults(data.results ?? []);
      } catch { setResults([]); }
    }, 200);
  }, [query]);

  const addLiked = (m: Movie) => {
    if (!liked.some((x) => x.index === m.index)) setLiked([...liked, m]);
    setQuery(''); setResults([]);
  };
  const removeLiked = (idx: number) => setLiked(liked.filter((m) => m.index !== idx));

  const getRecommendations = async () => {
    if (liked.length === 0) return;
    setLoading(true); setRecs([]);
    try {
      const r = await fetch(`${API}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked_indices: liked.map((m) => m.index), k: 12 }),
      });
      const data = await r.json();
      setRecs(data.recommendations ?? []);
    } catch {
      alert('Could not reach the recommender. Is the backend running on port 8000?');
    } finally { setLoading(false); }
  };

  const cleanTitle = (t: string) => t.replace(/\s*\(\d{4}\)\s*$/, '');
  const yearOf = (t: string) => (t.match(/\((\d{4})\)\s*$/)?.[1]) ?? '';

  return (
    <main className="wrap">
      <div className="glow" aria-hidden="true" />
      <header className="head">
        <div className="logo">
          <span className="logo-cine">Cine</span>
          <span className="logo-match">Match</span>
        </div>
        <p className="sub">Tell it a few films you love. It finds the ones you haven&apos;t seen yet.</p>
      </header>

      <section className="panel">
        <div className="eyebrow">Your taste</div>
        <div className="searchbox">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a film you love — try “The Matrix”"
            className="search"
          />
          {results.length > 0 && (
            <ul className="dropdown">
              {results.map((m) => (
                <li key={m.index} onClick={() => addLiked(m)}>
                  <span className="dtitle">{cleanTitle(m.title)}</span>
                  <span className="dyear">{yearOf(m.title)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {liked.length === 0 ? (
          <p className="empty">No films yet. Add a few above to shape your taste.</p>
        ) : (
          <div className="chips">
            {liked.map((m) => (
              <span key={m.index} className="chip">
                {cleanTitle(m.title)}
                <button onClick={() => removeLiked(m.index)} aria-label="remove">×</button>
              </span>
            ))}
          </div>
        )}

        <button className="cta" onClick={getRecommendations} disabled={liked.length === 0 || loading}>
          {loading ? 'Finding matches…' : `Recommend from ${liked.length || 'your'} pick${liked.length === 1 ? '' : 's'}`}
        </button>
      </section>

      {recs.length > 0 && (
        <section className="results">
          <div className="eyebrow because">
            Because you like {liked.map((m) => cleanTitle(m.title)).slice(0, 3).join(', ')}
            {liked.length > 3 ? '…' : ''}
          </div>
          <ol className="grid">
            {recs.map((m, i) => (
              <li key={m.index} className="card" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="rank">{String(i + 1).padStart(2, '0')}</div>
                <div className="cbody">
                  <div className="ctitle">{cleanTitle(m.title)}</div>
                  <div className="cmeta">
                    <span className="cyear">{yearOf(m.title)}</span>
                    <span className="cgenres">{m.genres.replaceAll('|', ' · ')}</span>
                  </div>
                </div>
                {m.score != null && <div className="match">{Math.round(m.score * 100)}<span>%</span></div>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Loading state — shown while fetching recommendations */}
      {loading && (
        <section className="loadwrap">
          <div className="reel" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <p className="loadtext">Analyzing your taste…</p>
          <div className="bar"><div className="barfill" /></div>
        </section>
      )}

      {/* Empty state — shown before any recommendation, when not loading */}
      {!loading && recs.length === 0 && (
        <section className="emptystate">
          <div className="emoji" aria-hidden="true">🎬</div>
          <p className="etitle">Your recommendations will appear here</p>
          <p className="etext">Add a few films you love above, and CineMatch finds the ones you haven&apos;t seen yet.</p>
        </section>
      )}

      <style jsx global>{`
        :root {
          --bg: #0b0b0d;
          --card: #16161a;
          --card-hover: #1c1c21;
          --line: rgba(255,255,255,0.08);
          --ink: #f5f5f7;
          --muted: #8b8b93;
          --dim: #5c5c66;
          --red: #a01e28;
          --red-bright: #c14550;
          --red-soft: rgba(160,30,40,0.15);
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; background: var(--bg); color: var(--ink);
          font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .wrap { max-width: 720px; margin: 0 auto; padding: 60px 24px 96px; position: relative; }
        /* soft cinematic red glow behind the header */
        .glow { position: absolute; top: -80px; left: 50%; transform: translateX(-50%);
          width: 520px; height: 280px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse at center, rgba(160,30,40,0.12), transparent 70%);
          filter: blur(30px); }
        .head { margin-bottom: 36px; position: relative; z-index: 1; }
        .logo { display: inline-flex; align-items: center; gap: 3px; }
        .logo-cine { font-size: 30px; font-weight: 700; color: var(--ink); letter-spacing: -0.03em; }
        .logo-match { font-size: 26px; font-weight: 600; color: #fff; background: var(--red);
          padding: 2px 12px; border-radius: 9px; letter-spacing: -0.02em;
          box-shadow: 0 0 16px rgba(160,30,40,0.35); }
        .sub { margin: 14px 0 0; color: var(--muted); font-size: 15px; max-width: 46ch; }
        .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em;
          color: var(--red-bright); margin-bottom: 14px; font-weight: 600; }
        .panel { background: var(--card); border: 1px solid var(--line);
          border-radius: 18px; padding: 26px; position: relative; z-index: 1; }
        .searchbox { position: relative; }
        .search { width: 100%; background: #0e0e11; border: 1px solid var(--line);
          border-radius: 12px; padding: 15px 16px; color: var(--ink); font-size: 15px; outline: none;
          transition: border-color 0.15s; }
        .search::placeholder { color: var(--dim); }
        .search:focus { border-color: var(--red); }
        .dropdown { list-style: none; margin: 6px 0 0; padding: 6px; position: absolute; z-index: 10;
          width: 100%; background: #18181c; border: 1px solid var(--line); border-radius: 12px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
        .dropdown li { display: flex; justify-content: space-between; align-items: center;
          padding: 11px 12px; border-radius: 8px; cursor: pointer; }
        .dropdown li:hover { background: var(--red-soft); }
        .dtitle { font-size: 14px; color: var(--ink); }
        .dyear { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .empty { color: var(--muted); font-size: 14px; margin: 18px 0; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0; }
        .chip { display: inline-flex; align-items: center; gap: 8px; background: var(--red-soft);
          border: 1px solid rgba(160,30,40,0.4); color: #d98a90; padding: 7px 10px 7px 13px;
          border-radius: 999px; font-size: 13px; font-weight: 500; }
        .chip button { background: none; border: none; color: #d98a90; cursor: pointer;
          font-size: 16px; line-height: 1; padding: 0; }
        .cta { width: 100%; margin-top: 10px; background: var(--red); color: white; border: none;
          border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 600; cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 0 0 rgba(160,30,40,0); }
        .cta:hover:not(:disabled) { background: var(--red-bright); box-shadow: 0 6px 22px rgba(160,30,40,0.3); }
        .cta:active:not(:disabled) { transform: scale(0.99); }
        .cta:disabled { background: #3a2225; color: #8a6a6d; cursor: not-allowed; }
        .results { margin-top: 44px; position: relative; z-index: 1; }
        .because { color: var(--red-bright); }
        .grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .card { display: flex; align-items: center; gap: 16px; background: var(--card);
          border: 1px solid var(--line); border-radius: 14px; padding: 16px 20px;
          animation: rise 0.4s ease both; transition: background 0.15s, border-color 0.15s, transform 0.15s; }
        .card:hover { background: var(--card-hover); border-color: rgba(160,30,40,0.45); transform: translateX(2px); }
        @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .rank { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 13px;
          color: var(--red); font-weight: 700; width: 24px; flex-shrink: 0; }
        .cbody { flex: 1; min-width: 0; }
        .ctitle { font-size: 16px; font-weight: 600; color: var(--ink); }
        .cmeta { display: flex; gap: 10px; align-items: center; margin-top: 3px; flex-wrap: wrap; }
        .cyear { font-size: 12px; color: var(--muted); font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .cgenres { font-size: 12px; color: var(--muted); }
        .match { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 19px;
          color: var(--red-bright); font-weight: 600; flex-shrink: 0; }
        .match span { font-size: 11px; color: var(--muted); }
        /* loading state */
        .loadwrap { margin-top: 48px; display: flex; flex-direction: column; align-items: center;
          text-align: center; position: relative; z-index: 1; }
        .reel { display: flex; gap: 7px; margin-bottom: 16px; }
        .reel span { width: 11px; height: 11px; border-radius: 50%; background: var(--red);
          animation: bounce 1s ease-in-out infinite; }
        .reel span:nth-child(2) { animation-delay: 0.15s; }
        .reel span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce { 0%,100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-8px); opacity: 1; } }
        .loadtext { color: var(--muted); font-size: 14px; margin: 0 0 16px; }
        .bar { width: 220px; height: 4px; background: rgba(255,255,255,0.08);
          border-radius: 999px; overflow: hidden; }
        .barfill { height: 100%; width: 40%; background: var(--red); border-radius: 999px;
          animation: slide 1.1s ease-in-out infinite; }
        @keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(320%); } }

        /* empty state */
        .emptystate { margin-top: 48px; text-align: center; padding: 40px 24px;
          border: 1px dashed var(--line); border-radius: 16px; position: relative; z-index: 1; }
        .emoji { font-size: 34px; margin-bottom: 12px; opacity: 0.9; }
        .etitle { color: var(--ink); font-size: 16px; font-weight: 600; margin: 0 0 6px; }
        .etext { color: var(--muted); font-size: 14px; margin: 0 auto; max-width: 42ch; line-height: 1.5; }

        @media (max-width: 520px) { .wrap { padding: 40px 16px 64px; } .logo-cine { font-size: 26px; } }
      `}</style>
    </main>
  );
}
