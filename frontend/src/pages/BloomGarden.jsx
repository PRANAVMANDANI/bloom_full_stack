import { useEffect, useState } from 'react';
import * as endpoints from '../api/endpoints';
import { DayPlant, WEEKDAY_FMT } from '../components/PlantVisual';
import { MOOD_EMOJIS } from '../utils/constants';
import {
  Flower2, Smile, Target, BookOpen, ShieldCheck, AlertTriangle, Sparkles, Quote,
} from 'lucide-react';

function bloomLabel(score) {
  if (score >= 0.85) return 'Flourishing';
  if (score >= 0.6) return 'Blooming';
  if (score >= 0.35) return 'Growing';
  if (score > 0) return 'Sprouting';
  return 'Resting';
}

// One week = one garden bed: a soil shelf of that week's daily plants, with a
// summary panel that slides in on hover / tap.
function GardenWeek({ week, index }) {
  const [open, setOpen] = useState(false);
  const s = week.summary;
  const scorePct = Math.round((s.bloom_score || 0) * 100);
  const moodEmoji = s.avg_mood ? MOOD_EMOJIS[Math.round(s.avg_mood)] : '—';

  return (
    <div
      className={`garden-week ${open ? 'open' : ''} ${week.is_current ? 'current' : ''}`}
      style={{ animationDelay: `${index * 70}ms` }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="garden-week-head">
        <div>
          <div className="garden-week-label">
            {week.label}
            {week.is_current && <span className="garden-week-badge">This week</span>}
          </div>
          <div className="garden-week-sub">{bloomLabel(s.bloom_score)} · {s.clean_days}/{s.days_tracked} clean days</div>
        </div>
        <div className="garden-week-score">
          <div className="garden-score-num">{scorePct}<span>%</span></div>
          <div className="garden-score-caption">bloom</div>
        </div>
      </div>

      {/* The plants sitting on their soil shelf */}
      <div className="garden-plot">
        {week.days.map((day) => (
          <div key={day.date} className="garden-plant">
            <DayPlant day={day} size={58} />
            <span className="garden-plant-day">{WEEKDAY_FMT.format(new Date(day.date)).slice(0, 1)}</span>
          </div>
        ))}
        <div className="garden-shelf" />
      </div>

      {/* Hover / tap summary */}
      <div className="garden-summary" role="group" aria-label={`Summary for ${week.label}`}>
        <div className="garden-summary-inner">
          <div className="garden-summary-title">
            <Sparkles size={15} /> Week in review
          </div>
          <div className="garden-summary-grid">
            <div className="garden-stat">
              <Smile size={15} style={{ color: 'var(--accent-mood)' }} />
              <div>
                <b>{s.avg_mood ? `${s.avg_mood}/10` : '—'} {s.avg_mood ? moodEmoji : ''}</b>
                <span>{s.mood_checkins} mood check-in{s.mood_checkins === 1 ? '' : 's'}</span>
              </div>
            </div>
            <div className="garden-stat">
              <Target size={15} style={{ color: 'var(--accent-goals)' }} />
              <div>
                <b>{s.goal_completions}</b>
                <span>goal completions</span>
              </div>
            </div>
            <div className="garden-stat">
              <BookOpen size={15} style={{ color: 'var(--accent-journal)' }} />
              <div>
                <b>{s.journal_entries}</b>
                <span>journal entr{s.journal_entries === 1 ? 'y' : 'ies'}</span>
              </div>
            </div>
            <div className="garden-stat">
              <ShieldCheck size={15} style={{ color: 'var(--accent-chat)' }} />
              <div>
                <b>{s.urges_resisted}</b>
                <span>urges resisted</span>
              </div>
            </div>
          </div>

          {s.best_goal && (
            <div className="garden-summary-note">
              <Target size={13} style={{ color: 'var(--accent-goals)', flexShrink: 0 }} />
              Most consistent: <b>{s.best_goal}</b> ({s.best_goal_count}/7 days)
            </div>
          )}
          {s.relapses > 0 && (
            <div className="garden-summary-note warn">
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              {s.relapses} relapse{s.relapses === 1 ? '' : 's'} this week — a fresh start, not a failure.
            </div>
          )}
          {s.journal_snippet && (
            <div className="garden-summary-journal">
              <Quote size={13} style={{ color: 'var(--accent-journal)', flexShrink: 0, transform: 'scaleX(-1)' }} />
              <span>{s.journal_snippet}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BloomGarden() {
  const [weeks, setWeeks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await endpoints.getGarden(12);
        setWeeks(res.data.weeks || []);
      } catch (err) {
        console.error('Failed to load garden', err);
        // A 404 here almost always means the backend is running older code
        // without the /api/garden route — surface that instead of pretending
        // the garden is simply empty.
        setError(
          err?.response?.status === 404
            ? "The garden endpoint isn't available on the server yet. Restart the backend to load the new /api/garden route."
            : 'Something went wrong loading your garden. Please try again in a moment.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h1>Bloom Garden</h1>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <Flower2 size={44} style={{ color: 'var(--accent-mood)', opacity: 0.6, marginBottom: 'var(--space-md)' }} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const totalBlooms = weeks.reduce(
    (n, w) => n + w.days.filter((d) => (d.goal_pct || 0) >= 0.75 && !d.relapsed).length,
    0,
  );
  const bestWeek = weeks.reduce(
    (best, w) => (w.summary.bloom_score > (best?.summary.bloom_score ?? -1) ? w : best),
    null,
  );

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Flower2 size={34} style={{ color: 'var(--accent-goals)', marginTop: '2px' }} />
          <div>
            <h1 style={{ margin: '0 0 var(--space-xs)' }}>Bloom Garden</h1>
            <p style={{ margin: 0 }}>Every week you tend becomes a bed in your garden. Hover a week to see how it grew.</p>
          </div>
        </div>
      </div>

      {/* Garden-wide stats */}
      <div className="garden-topstats">
        <div className="garden-topstat">
          <div className="garden-topstat-num">{weeks.length}</div>
          <div className="garden-topstat-label">weeks planted</div>
        </div>
        <div className="garden-topstat">
          <div className="garden-topstat-num">{totalBlooms}</div>
          <div className="garden-topstat-label">days in full bloom</div>
        </div>
        <div className="garden-topstat">
          <div className="garden-topstat-num">{bestWeek ? Math.round(bestWeek.summary.bloom_score * 100) : 0}<span style={{ fontSize: '1rem' }}>%</span></div>
          <div className="garden-topstat-label">best week{bestWeek ? ` · ${bestWeek.label}` : ''}</div>
        </div>
      </div>

      {weeks.length === 0 || (weeks.length === 1 && !weeks[0].summary.days_tracked) ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <Flower2 size={44} style={{ color: 'var(--color-text-muted)', opacity: 0.5, marginBottom: 'var(--space-md)' }} />
          <p>Your garden is just getting started. Complete goals, check in, and journal — each week will grow its own little bed of flowers here.</p>
        </div>
      ) : (
        <div className="garden-grid">
          {weeks.map((week, i) => (
            <GardenWeek key={week.week_start} week={week} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
