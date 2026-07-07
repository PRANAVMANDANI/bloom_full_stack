import { useState, useEffect } from 'react';
import * as endpoints from '../api/endpoints';
import useStore from '../store/useStore';
import { TRIGGER_TAGS } from '../utils/constants';
import { getIntensityClass, formatDate, formatTime } from '../utils/helpers';
import { Flame, Plus, Trash2, AlertTriangle, Activity, RefreshCw, Sprout, Heart } from 'lucide-react';

export default function HabitTracker() {
  const [habits, setHabits] = useState([]);
  const [urgeLogs, setUrgeLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [showUrgeModal, setShowUrgeModal] = useState(false);
  const [showRelapseConfirm, setShowRelapseConfirm] = useState(false);
  const [showRelapseSupport, setShowRelapseSupport] = useState(false);
  const [relapseMessage, setRelapseMessage] = useState('');
  const [relapseLoading, setRelapseLoading] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitType, setNewHabitType] = useState('quit');
  const [urgeIntensity, setUrgeIntensity] = useState(5);
  const [urgeTriggers, setUrgeTriggers] = useState([]);
  const [urgeNotes, setUrgeNotes] = useState('');
  const [showUrgeSupport, setShowUrgeSupport] = useState(false);
  const [urgeSupportMessage, setUrgeSupportMessage] = useState('');
  const [urgeSupportLoading, setUrgeSupportLoading] = useState(false);
  const showToast = useStore((s) => s.showToast);

  const fetchData = async () => {
    try {
      const [habitsRes, urgesRes] = await Promise.all([
        endpoints.getHabits(),
        endpoints.getUrgeLogs(),
      ]);
      setHabits(habitsRes.data);
      setUrgeLogs(urgesRes.data);
    } catch (err) {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateHabit = async (e) => {
    e.preventDefault();
    try {
      await endpoints.createHabit({ name: newHabitName, type: newHabitType });
      setNewHabitName('');
      setShowHabitModal(false);
      fetchData();
      showToast('Habit tracking started! 💪');
    } catch (err) {
      showToast('Failed to create habit', 'error');
    }
  };

  const handleLogUrge = async (e) => {
    e.preventDefault();
    if (!selectedHabit) return;
    setShowUrgeModal(false);
    setShowUrgeSupport(true);
    setUrgeSupportLoading(true);
    setUrgeSupportMessage('');
    try {
      const res = await endpoints.createUrgeLog({
        habit_id: selectedHabit.id,
        intensity: urgeIntensity,
        trigger_tags: urgeTriggers,
        notes: urgeNotes || null,
      });
      setUrgeSupportMessage(res.data.message);
      setUrgeIntensity(5);
      setUrgeTriggers([]);
      setUrgeNotes('');
      fetchData();
    } catch (err) {
      showToast('Failed to log urge', 'error');
      setShowUrgeSupport(false);
    } finally {
      setUrgeSupportLoading(false);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    if (!confirm('Delete this habit and all its logs?')) return;
    try {
      await endpoints.deleteHabit(habitId);
      fetchData();
      showToast('Habit removed');
    } catch (err) {
      showToast('Failed to delete', 'error');
    }
  };

  const handleOpenRelapseModal = (habit) => {
    setSelectedHabit(habit);
    setShowRelapseConfirm(true);
  };

  const handleConfirmRelapse = async () => {
    if (!selectedHabit) return;
    setRelapseLoading(true);
    setShowRelapseConfirm(false);
    setShowRelapseSupport(true);
    setRelapseMessage('');
    try {
      const res = await endpoints.logRelapse(selectedHabit.id);
      setRelapseMessage(res.data.message);
      fetchData();
      showToast('Relapse logged. Let\'s start fresh. 🌿');
    } catch (err) {
      showToast('Failed to log relapse', 'error');
      setShowRelapseSupport(false);
    } finally {
      setRelapseLoading(false);
    }
  };

  const toggleTrigger = (tag) => {
    setUrgeTriggers((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Flame size={36} style={{ color: 'var(--accent-goals)', marginTop: '4px' }} />
            <div>
              <h1 style={{ margin: '0 0 var(--space-xs)' }}>Habit Tracker</h1>
              <p style={{ margin: 0 }}>Track your habits, log urges, and see your strength grow.</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowHabitModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Track Habit
          </button>
        </div>
      </div>

      {/* Habits */}
      {habits.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-2xl) var(--space-md)' }}>
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Flame size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)', opacity: 0.5 }} />
            <p>Start tracking a habit to see your progress</p>
          </div>
        </div>
      ) : (
        <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
          {habits.map((habit) => (
            <div className="card" key={habit.id}>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>{habit.name}</h3>
                  <span className={`tag tag-${habit.type === 'quit' ? 'rose' : habit.type === 'reduce' ? 'peach' : 'sage'}`}>
                    {habit.type}
                  </span>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => handleDeleteHabit(habit.id)} title="Delete" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="streak-card" style={{ marginBottom: 'var(--space-md)' }}>
                <div className="streak-number">{habit.sobriety_days}</div>
                <div className="streak-label">days strong</div>
              </div>
              <div className="flex gap-sm">
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => {
                    setSelectedHabit(habit);
                    setShowUrgeModal(true);
                  }}
                >
                  <Activity size={15} /> Log Urge
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => handleOpenRelapseModal(habit)}
                >
                  <AlertTriangle size={15} /> Relapsed
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Urge Logs */}
      {urgeLogs.length > 0 && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: 'var(--accent-journal)' }} />
            <h3 className="card-title" style={{ margin: 0 }}>Recent Urge Logs</h3>
          </div>
          <div className="urge-timeline">
            {urgeLogs.slice(0, 10).map((log) => (
              <div className="urge-item" key={log.id}>
                <div className={`urge-intensity ${getIntensityClass(log.intensity)}`}>
                  {log.intensity}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', marginBottom: '4px' }}>
                    {formatDate(log.timestamp)} at {formatTime(log.timestamp)}
                  </div>
                  {log.trigger_tags.length > 0 && (
                    <div className="tag-group" style={{ marginBottom: '4px' }}>
                      {log.trigger_tags.map((tag) => (
                        <span className="tag tag-lavender" key={tag} style={{ fontSize: '0.75rem' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  {log.notes && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{log.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Habit Modal */}
      {showHabitModal && (
        <div className="modal-overlay" onClick={() => setShowHabitModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Track a New Habit</h3>
            <form onSubmit={handleCreateHabit}>
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="input-label" htmlFor="habit-name">Habit name</label>
                <input
                  id="habit-name"
                  className="input"
                  type="text"
                  placeholder="e.g., Quit smoking"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="input-label" htmlFor="habit-type">Type</label>
                <select id="habit-type" className="input" value={newHabitType} onChange={(e) => setNewHabitType(e.target.value)}>
                  <option value="quit">Quit (stop completely)</option>
                  <option value="reduce">Reduce (cut back)</option>
                  <option value="build">Build (form new habit)</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowHabitModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Start Tracking</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Urge Modal */}
      {showUrgeModal && (
        <div className="modal-overlay" onClick={() => setShowUrgeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Log an Urge — {selectedHabit?.name}</h3>
            <form onSubmit={handleLogUrge}>
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="input-label">Intensity: {urgeIntensity}/10</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={urgeIntensity}
                  onChange={(e) => setUrgeIntensity(Number(e.target.value))}
                  className="mood-slider"
                  style={{ maxWidth: '100%' }}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="input-label">What triggered it?</label>
                <div className="tag-group">
                  {TRIGGER_TAGS.map((tag) => (
                    <span
                      key={tag}
                      className={`tag ${urgeTriggers.includes(tag) ? 'tag-sage active' : 'tag-lavender'}`}
                      onClick={() => toggleTrigger(tag)}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="input-label" htmlFor="urge-notes">Notes (optional)</label>
                <textarea
                  id="urge-notes"
                  className="input"
                  placeholder="What were you feeling or doing?"
                  value={urgeNotes}
                  onChange={(e) => setUrgeNotes(e.target.value)}
                  style={{ minHeight: '80px' }}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUrgeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Log Urge</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Relapse Confirm Modal */}
      {showRelapseConfirm && (
        <div className="modal-overlay" onClick={() => setShowRelapseConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ color: 'var(--color-peach)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sprout size={20} /> Fresh Start
            </h3>
            <p style={{ marginBottom: 'var(--space-lg)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              It's okay. Relapse is not a failure — it's a normal, non-linear step in the recovery journey.
              <br /><br />
              Are you ready to log this relapse and reset your sobriety counter to 0 days? We'll be here to support you.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowRelapseConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmRelapse} disabled={relapseLoading}>
                {relapseLoading ? 'Resetting...' : 'Yes, start fresh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relapse Support Modal */}
      {showRelapseSupport && (
        <div className="modal-overlay" onClick={() => setShowRelapseSupport(false)}>
          <div className="modal" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Heart size={20} style={{ color: 'var(--accent-chat)' }} /> Bloom Companion
            </h3>
            <div style={{
              background: 'var(--color-bg-elevated)',
              padding: 'var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-line',
              marginBottom: 'var(--space-lg)'
            }}>
              {relapseLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)' }}>
                  <div className="spinner" />
                  <p style={{ textAlign: 'center', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                    Bloom is preparing a gentle message for you...
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                    "Recovery is non-linear. Take a slow, deep breath in... and let it out. 🌱"
                  </p>
                </div>
              ) : (
                relapseMessage
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setShowRelapseSupport(false)}>
                Take a deep breath and continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Urge Coping Support Modal */}
      {showUrgeSupport && (
        <div className="modal-overlay" onClick={() => setShowUrgeSupport(false)}>
          <div className="modal" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Heart size={20} style={{ color: 'var(--accent-chat)' }} /> Bloom Companion
            </h3>
            <div style={{
              background: 'var(--color-bg-elevated)',
              padding: 'var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-line',
              marginBottom: 'var(--space-lg)'
            }}>
              {urgeSupportLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)' }}>
                  <div className="spinner" />
                  <p style={{ textAlign: 'center', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                    Bloom is thinking of some ways to help...
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                    "This feeling is temporary. You are stronger than the urge. 🌱"
                  </p>
                </div>
              ) : (
                urgeSupportMessage
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setShowUrgeSupport(false)}>
                Got it, thank you
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
