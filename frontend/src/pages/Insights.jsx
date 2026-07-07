import { useState, useEffect } from 'react';
import * as endpoints from '../api/endpoints';
import useStore from '../store/useStore';
import { formatDate } from '../utils/helpers';
import { Sparkles, Smile, Target, Flame, BookOpen, Wand2, Link2, CalendarDays, RefreshCw } from 'lucide-react';

const INSIGHT_LUCIDE_ICONS = {
  mood: <Smile size={16} style={{ color: 'var(--accent-mood)' }} />,
  goals: <Target size={16} style={{ color: 'var(--accent-goals)' }} />,
  urges: <Flame size={16} style={{ color: 'var(--accent-journal)' }} />,
  sentiment: <BookOpen size={16} style={{ color: 'var(--accent-chat)' }} />,
  correlation: <Link2 size={16} style={{ color: 'var(--accent-chat)' }} />,
  general: <Sparkles size={16} style={{ color: 'var(--accent-goals)' }} />,
};

export default function Insights() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [weeklyReview, setWeeklyReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [generatingReview, setGeneratingReview] = useState(false);
  const showToast = useStore((s) => s.showToast);

  const fetchInsights = async () => {
    try {
      const res = await endpoints.getInsights(20);
      setInsights(res.data);
    } catch (err) {
      showToast('Failed to load insights', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyReview = async () => {
    try {
      const res = await endpoints.getWeeklyReview();
      setWeeklyReview(res.data);
    } catch (err) {
      // Non-fatal: the page still works without a review.
      console.error('Failed to load weekly review', err);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleGenerateReview = async () => {
    setGeneratingReview(true);
    try {
      const res = await endpoints.generateWeeklyReview();
      setWeeklyReview(res.data);
      showToast('Your weekly review is ready 🌿');
    } catch (err) {
      const detail = err.response?.data?.detail;
      showToast(detail || 'Failed to generate weekly review', 'error');
    } finally {
      setGeneratingReview(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    fetchWeeklyReview();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await endpoints.generateInsights();
      await fetchInsights();
      showToast('Fresh insights generated! ✨');
    } catch (err) {
      const detail = err.response?.data?.detail;
      showToast(detail || 'Failed to generate insights', 'error');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  // Group insights by date
  const grouped = insights.reduce((acc, insight) => {
    const date = formatDate(insight.generated_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(insight);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Sparkles size={36} style={{ color: 'var(--accent-journal)', marginTop: '4px' }} />
            <div>
              <h1 style={{ margin: '0 0 var(--space-xs)' }}>Insights</h1>
              <p style={{ margin: 0 }}>Personalized observations based on your activity. Generated nightly — or on demand.</p>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Wand2 size={16} /> {generating ? 'Analyzing your data...' : 'Generate Now'}
          </button>
        </div>
      </div>

      {/* Weekly Review */}
      <div className="weekly-review-card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="flex items-center justify-between" style={{ gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarDays size={22} style={{ color: 'var(--accent-chat)' }} />
            <h3 className="card-title" style={{ margin: 0 }}>Your Week in Review</h3>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleGenerateReview}
            disabled={generatingReview}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={generatingReview ? 'spin' : ''} />
            {generatingReview ? 'Reflecting...' : weeklyReview ? 'Refresh' : 'Generate'}
          </button>
        </div>

        {reviewLoading ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>Loading your reflection…</p>
        ) : weeklyReview ? (
          <>
            {weeklyReview.stats && (
              <div className="weekly-stat-row">
                <div className="weekly-stat"><span>{weeklyReview.stats.mood_checkins ?? 0}</span>mood check-ins</div>
                <div className="weekly-stat"><span>{weeklyReview.stats.goal_completions ?? 0}</span>goals done</div>
                <div className="weekly-stat"><span>{weeklyReview.stats.journal_entries ?? 0}</span>journal entries</div>
                <div className="weekly-stat"><span>{weeklyReview.stats.avg_mood ?? '—'}</span>avg mood</div>
              </div>
            )}
            <div className="weekly-review-body" style={{ whiteSpace: 'pre-wrap' }}>{weeklyReview.summary}</div>
            {weeklyReview.generated_at && (
              <div style={{ marginTop: 'var(--space-md)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Generated {formatDate(weeklyReview.generated_at)} · refreshes every Monday
              </div>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.92rem', margin: 0 }}>
            A warm, AI-written reflection on your week — moods, streaks, journaling and wins. Hit
            <strong> Generate</strong> to create your first one (it also refreshes automatically every Monday).
          </p>
        )}
      </div>

      {insights.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Sparkles size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)', opacity: 0.5 }} />
            <p>No insights yet. Keep tracking your mood, goals, and habits — then hit “Generate Now” or wait for the nightly analysis.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-xl">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-md)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
              }}>
                {date}
              </h3>
              <div className="flex flex-col gap-md">
                {items.map((insight) => (
                  <div className={`insight-card ${insight.type}`} key={insight.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ marginTop: '2px' }}>
                      {INSIGHT_LUCIDE_ICONS[insight.type] || <Sparkles size={16} />}
                    </div>
                    <div>
                      <div className="insight-type" style={{ margin: 0, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        {insight.type}
                      </div>
                      <div className="insight-message" style={{ marginTop: '4px' }}>{insight.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
