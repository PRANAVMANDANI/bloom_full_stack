import { useState, useEffect, useRef, useMemo } from 'react';
import * as endpoints from '../api/endpoints';
import useStore from '../store/useStore';
import { formatDate, getSentimentInfo } from '../utils/helpers';
import { JOURNAL_PROMPTS } from '../utils/constants';
import { BookOpen, Search, Trash2, Lightbulb, RefreshCw, ChevronDown, ChevronUp, X, Calendar } from 'lucide-react';

// Pull a generous window of entries so the month filter has full months to group by.
// Capped at 100 to match the backend's `limit` validation (le=100) on GET /api/journal.
const ENTRY_LIMIT = 100;

// "2026-07" sort/compare key and "July 2026" display label for an entry timestamp.
const monthKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (ts) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export default function Journal() {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastSentiment, setLastSentiment] = useState(null);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [promptIdx, setPromptIdx] = useState(() => Math.floor(Math.random() * JOURNAL_PROMPTS.length));
  const [showPrompt, setShowPrompt] = useState(false);
  const searchTimer = useRef(null);
  const showToast = useStore((s) => s.showToast);

  const fetchEntries = async (q = '') => {
    try {
      const res = await endpoints.getJournalEntries(ENTRY_LIMIT, q);
      setEntries(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Debounced server-side search
  const handleSearchChange = (value) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchEntries(value), 350);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await endpoints.createJournalEntry({ text: text.trim() });
      setLastSentiment(res.data.sentiment_score);
      setText('');
      setShowPrompt(false);
      fetchEntries(search);
      showToast('Journal entry saved 🌱');
    } catch (err) {
      showToast('Failed to save entry', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entryId) => {
    if (!confirm('Delete this journal entry? This cannot be undone.')) return;
    try {
      await endpoints.deleteJournalEntry(entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      showToast('Entry deleted');
    } catch (err) {
      showToast('Failed to delete entry', 'error');
    }
  };

  const nextPrompt = () => {
    setPromptIdx((i) => (i + 1) % JOURNAL_PROMPTS.length);
  };

  const usePrompt = () => {
    setText((t) => (t ? t + '\n\n' : '') + JOURNAL_PROMPTS[promptIdx] + '\n');
    document.getElementById('journal-text')?.focus();
  };

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  // Distinct months present in the loaded entries, newest first: [['2026-07', 'July 2026'], ...]
  const monthOptions = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const key = monthKey(e.timestamp);
      if (!map.has(key)) map.set(key, monthLabel(e.timestamp));
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  // If the selected month disappears (e.g. after a search), fall back to "all".
  useEffect(() => {
    if (monthFilter !== 'all' && !monthOptions.some(([key]) => key === monthFilter)) {
      setMonthFilter('all');
    }
  }, [monthOptions, monthFilter]);

  const visibleEntries = monthFilter === 'all'
    ? entries
    : entries.filter((e) => monthKey(e.timestamp) === monthFilter);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <BookOpen size={36} style={{ color: 'var(--accent-journal)', marginTop: '4px' }} />
        <div>
          <h1 style={{ margin: '0 0 var(--space-xs)' }}>Journal</h1>
          <p style={{ margin: 0 }}>Write freely. Your words are private, and your feelings are valid.</p>
        </div>
      </div>

      {/* Write New Entry */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <div className="flex items-center justify-between">
              <label className="input-label" htmlFor="journal-text">
                What's on your mind?
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPrompt((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-journal)' }}
              >
                <Lightbulb size={14} /> {showPrompt ? 'Hide prompt' : 'Need a prompt?'}
              </button>
            </div>

            {showPrompt && (
              <div style={{
                background: 'var(--color-lavender-dim)',
                border: '1px solid rgba(125, 107, 168, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md) var(--space-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                animation: 'slideUp 0.25s ease',
              }}>
                <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--accent-journal)', fontStyle: 'italic' }}>
                  “{JOURNAL_PROMPTS[promptIdx]}”
                </span>
                <button type="button" className="btn btn-ghost btn-icon" onClick={nextPrompt} title="Another prompt" style={{ color: 'var(--accent-journal)' }}>
                  <RefreshCw size={14} />
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={usePrompt}>
                  Use it
                </button>
              </div>
            )}

            <textarea
              id="journal-text"
              className="input"
              placeholder="Start writing... There's no right or wrong here."
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ minHeight: '200px' }}
              required
            />
          </div>
          <div className="flex items-center justify-between mt-md">
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {wordCount} word{wordCount !== 1 ? 's' : ''}
            </span>
            <button className="btn btn-primary" type="submit" disabled={submitting || !text.trim()}>
              {submitting ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>

        {/* Sentiment feedback after save */}
        {lastSentiment !== null && (
          <div style={{
            marginTop: 'var(--space-lg)',
            padding: 'var(--space-md) var(--space-lg)',
            background: 'var(--color-bg-elevated)',
            borderRadius: 'var(--radius-md)',
            animation: 'slideUp 0.3s ease',
          }}>
            <div style={{ fontSize: '0.875rem', marginBottom: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}>
              Sentiment Analysis
            </div>
            <div className="flex items-center gap-md">
              <div className="sentiment-bar" style={{ flex: 1 }}>
                <div
                  className={`sentiment-fill ${getSentimentInfo(lastSentiment).cls}`}
                  style={{ width: `${((lastSentiment + 1) / 2) * 100}%` }}
                />
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: getSentimentInfo(lastSentiment).color }}>
                {getSentimentInfo(lastSentiment).label}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Past Entries */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-lg)', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>Past Entries</h3>
          <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '150px' }}>
            <Calendar size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            <select
              className="input"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Filter entries by month"
              style={{ paddingLeft: '32px', width: '100%', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              <option value="all">All months</option>
              {monthOptions.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="input"
              type="text"
              placeholder="Search your entries..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: search ? '32px' : undefined, width: '100%', fontSize: '0.875rem' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : visibleEntries.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <p>
                {search
                  ? `No entries matching “${search}”.`
                  : monthFilter !== 'all'
                    ? `No entries from ${monthOptions.find(([k]) => k === monthFilter)?.[1] || 'that month'}.`
                    : 'No entries yet. Your first one is a great place to start.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            {visibleEntries.map((entry) => {
              const sentiment = getSentimentInfo(entry.sentiment_score || 0);
              const isExpanded = expandedId === entry.id;
              const isLong = entry.text.length > 260;
              return (
                <div className="journal-entry" key={entry.id}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-sm)' }}>
                    <div className="journal-date">{formatDate(entry.timestamp)}</div>
                    <div className="flex items-center gap-sm">
                      {entry.sentiment_score !== null && (
                        <span style={{ fontSize: '0.75rem', color: sentiment.color, fontWeight: 500 }}>
                          {sentiment.label}
                        </span>
                      )}
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleDelete(entry.id)}
                        title="Delete entry"
                        style={{ padding: '4px', color: 'var(--color-text-muted)', display: 'flex' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div
                    className="journal-text"
                    style={isExpanded ? { display: 'block', WebkitLineClamp: 'unset', whiteSpace: 'pre-wrap' } : undefined}
                  >
                    {entry.text}
                  </div>
                  {isLong && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      style={{ marginTop: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-journal)', padding: '2px 8px' }}
                    >
                      {isExpanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Read more</>}
                    </button>
                  )}
                  {entry.sentiment_score !== null && (
                    <div className="sentiment-bar" style={{ marginTop: 'var(--space-md)' }}>
                      <div
                        className={`sentiment-fill ${sentiment.cls}`}
                        style={{ width: `${((entry.sentiment_score + 1) / 2) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
