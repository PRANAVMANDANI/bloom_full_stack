import { useState, useEffect } from 'react';
import * as endpoints from '../api/endpoints';
import useStore from '../store/useStore';
import { MOOD_EMOJIS, MOOD_TAGS } from '../utils/constants';
import { formatDate, formatTime } from '../utils/helpers';
import { Smile, Calendar } from 'lucide-react';

export default function MoodCheckin() {
  const [moodScore, setMoodScore] = useState(5);
  const [selectedTags, setSelectedTags] = useState([]);
  const [notes, setNotes] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useStore((s) => s.showToast);

  const fetchLogs = async () => {
    try {
      const res = await endpoints.getMoodLogs();
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await endpoints.createMoodLog({
        mood_score: moodScore,
        tags: selectedTags,
        notes: notes || null,
      });
      showToast('Mood check-in recorded! 🌱');
      setNotes('');
      setSelectedTags([]);
      setMoodScore(5);
      fetchLogs();
    } catch (err) {
      showToast('Failed to save mood', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Smile size={36} style={{ color: 'var(--accent-mood)', marginTop: '4px' }} />
        <div>
          <h1 style={{ margin: '0 0 var(--space-xs)' }}>Mood Check-in</h1>
          <p style={{ margin: 0 }}>How are you feeling right now? There's no wrong answer.</p>
        </div>
      </div>

      {/* Mood Input Card */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <form onSubmit={handleSubmit}>
          <div className="mood-slider-container">
            <div className="mood-emoji">{MOOD_EMOJIS[moodScore]}</div>
            <div className="mood-score-display">{moodScore}/10</div>
            <input
              type="range"
              min="1"
              max="10"
              value={moodScore}
              onChange={(e) => setMoodScore(Number(e.target.value))}
              className="mood-slider"
            />
            <div className="flex justify-between w-full" style={{ maxWidth: '400px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              <span>Not great</span>
              <span>Wonderful</span>
            </div>
          </div>

          <div className="input-group" style={{ marginTop: 'var(--space-xl)' }}>
            <label className="input-label">How would you describe it?</label>
            <div className="tag-group">
              {MOOD_TAGS.map((tag) => (
                <span
                  key={tag}
                  className={`tag ${selectedTags.includes(tag) ? 'tag-peach active' : 'tag-lavender'}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="input-group" style={{ marginTop: 'var(--space-lg)' }}>
            <label className="input-label" htmlFor="mood-notes">Notes (optional)</label>
            <textarea
              id="mood-notes"
              className="input"
              placeholder="Anything you'd like to note about today..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: '80px' }}
            />
          </div>

          <button
            className="btn btn-primary btn-lg w-full mt-xl"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Save Check-in'}
          </button>
        </form>
      </div>

      {/* Recent Mood Logs */}
      {logs.length > 0 && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--accent-goals)' }} />
            <h3 className="card-title" style={{ margin: 0 }}>Recent Check-ins</h3>
          </div>
          <div className="flex flex-col gap-sm">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
              }}>
                <span style={{ fontSize: '1.5rem' }}>{MOOD_EMOJIS[log.mood_score]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{log.mood_score}/10</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {formatDate(log.timestamp)} · {formatTime(log.timestamp)}
                  </div>
                </div>
                {log.tags.length > 0 && (
                  <div className="tag-group">
                    {log.tags.map((tag) => (
                      <span className="tag tag-sky" key={tag} style={{ fontSize: '0.7rem', pointerEvents: 'none' }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
