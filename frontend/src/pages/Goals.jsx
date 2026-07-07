import { useState, useEffect } from 'react';
import * as endpoints from '../api/endpoints';
import useStore from '../store/useStore';
import { Target, Flame, Trash2, Plus, ChevronLeft, ChevronRight, Snowflake } from 'lucide-react';

function UnsproutedSeedVisual() {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-goals)', marginBottom: 'var(--space-md)', opacity: 0.85 }}>
      <path d="M3 20c4-2 14-2 18 0" strokeWidth="2" />
      <path d="M12 18c-2.5 0-4-1.5-4-3.5s1.5-3.5 4-3.5s4 1.5 4 3.5s-1.5 3.5-4 3.5z" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 11c0-2.5 1-3.5 2.5-4" strokeWidth="2" />
      <path d="M12.5 8.5c1.5-.5 2.5-2 2-3s-2-1-3 .5c-.5 1-.5 2 .5 2.5z" fill="var(--accent-goals)" fillOpacity="0.5" />
    </svg>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFrequency, setNewFrequency] = useState('daily');
  const [freezeMode, setFreezeMode] = useState(false);
  const showToast = useStore((s) => s.showToast);

  // Month navigator state (1-indexed month)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

  const fetchGoals = async () => {
    try {
      const res = await endpoints.getGoals();
      setGoals(res.data);
    } catch (err) {
      showToast('Failed to load goals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await endpoints.createGoal({ title: newTitle.trim(), frequency: newFrequency });
      setNewTitle('');
      setShowModal(false);
      fetchGoals();
      showToast('Goal created! 🌱');
    } catch (err) {
      showToast('Failed to create goal', 'error');
    }
  };

  const handleDelete = async (goalId) => {
    if (!confirm('Delete this goal?')) return;
    try {
      await endpoints.deleteGoal(goalId);
      fetchGoals();
      showToast('Goal removed');
    } catch (err) {
      showToast('Failed to delete goal', 'error');
    }
  };

  const handleToggleCell = async (goalId, dateStr) => {
    try {
      const res = await endpoints.toggleGoalDate(goalId, dateStr);
      setGoals((prev) => prev.map((g) => (g.id === goalId ? res.data : g)));
    } catch (err) {
      showToast('Failed to update goal date', 'error');
    }
  };

  const handleFreezeCell = async (goalId, dateStr) => {
    try {
      const res = await endpoints.freezeGoalDate(goalId, dateStr);
      setGoals((prev) => prev.map((g) => (g.id === goalId ? res.data : g)));
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to freeze day', 'error');
    }
  };

  // In freeze mode, clicking a missed past day protects it; otherwise toggle completion.
  const handleCellClick = (goalId, dateStr) => {
    if (freezeMode) handleFreezeCell(goalId, dateStr);
    else handleToggleCell(goalId, dateStr);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  // Days calculations
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const selectedMonthName = monthNames[currentMonth - 1];

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const pad = (n) => String(n).padStart(2, '0');
  const dateFor = (day) => `${currentYear}-${pad(currentMonth)}-${pad(day)}`;

  // Precompute per-goal monthly completion stats (used by the grid + summary).
  const goalStats = goals.map((goal) => {
    const createdDateStr = new Date(goal.created_at).toISOString().split('T')[0];
    let activeDaysCount = 0;
    let monthCompletedCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = dateFor(d);
      if (dStr <= todayStr && dStr >= createdDateStr) {
        activeDaysCount++;
        if (goal.completed_dates.includes(dStr)) monthCompletedCount++;
      }
    }
    const completionRate = activeDaysCount > 0 ? Math.round((monthCompletedCount / activeDaysCount) * 100) : 0;
    return { goal, createdDateStr, activeDaysCount, monthCompletedCount, completionRate };
  });

  const overallActive = goalStats.reduce((s, g) => s + g.activeDaysCount, 0);
  const overallCompleted = goalStats.reduce((s, g) => s + g.monthCompletedCount, 0);
  const overallRate = overallActive > 0 ? Math.round((overallCompleted / overallActive) * 100) : 0;
  const bestRate = goalStats.reduce((m, g) => Math.max(m, g.completionRate), 0);

  const rateColor = (r) =>
    r >= 70 ? 'var(--accent-goals)' : r >= 40 ? 'var(--color-amber)' : 'var(--color-text-muted)';

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Target size={36} style={{ color: 'var(--accent-goals)', marginTop: '4px' }} />
            <div>
              <h1 style={{ margin: '0 0 var(--space-xs)' }}>Daily Goals</h1>
              <p style={{ margin: 0 }}>Small steps, big changes. Set intentions and track your progress.</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> New Goal
          </button>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="month-navigator">
        <button className="month-navigator-btn" onClick={handlePrevMonth} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className="month-navigator-label">{selectedMonthName} {currentYear}</span>
        <button className="month-navigator-btn" onClick={handleNextMonth} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      {goals.length > 0 && (
        <div className="goals-summary">
          <div className="hero-stat-item">
            <div className="hero-stat-value" style={{ color: 'var(--accent-goals)' }}>{goals.length}</div>
            <div className="hero-stat-label">Active Goals</div>
          </div>
          <div className="hero-stat-item">
            <div className="hero-stat-value" style={{ color: rateColor(overallRate) }}>{overallRate}%</div>
            <div className="hero-stat-label">{selectedMonthName} Completion</div>
          </div>
          <div className="hero-stat-item">
            <div className="hero-stat-value" style={{ color: rateColor(bestRate) }}>{bestRate}%</div>
            <div className="hero-stat-label">Best Goal Rate</div>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-2xl) var(--space-md)' }}>
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <UnsproutedSeedVisual />
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: 'var(--space-sm)' }}>Plant a New Intention</h3>
            <p style={{ maxWidth: '400px', margin: '0 auto var(--space-lg)', lineHeight: 1.6 }}>
              No goals have been planted for today yet. Break your journey down into small, daily practices.
            </p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Create First Goal
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="flex items-center justify-between" style={{ gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
          <div className="goals-grid-caption" style={{ marginBottom: 0 }}>
            {freezeMode ? (
              <><Snowflake size={13} style={{ color: 'var(--accent-chat)' }} /> Freeze mode: tap a missed past day to protect your streak (3 freezes/goal per month).</>
            ) : (
              <><ChevronLeft size={13} style={{ opacity: 0.6 }} /> Tap a circle to mark a day complete. Scroll sideways to see the whole month. <ChevronRight size={13} style={{ opacity: 0.6 }} /></>
            )}
          </div>
          <button
            className={`btn btn-sm ${freezeMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFreezeMode((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
          >
            <Snowflake size={14} /> {freezeMode ? 'Done freezing' : 'Streak freeze'}
          </button>
        </div>
        <div className={`goals-grid-container ${freezeMode ? 'freeze-mode-active' : ''}`}>
          <table className="goals-grid-table">
            <thead>
              <tr>
                <th className="goals-grid-th goal-column">Goal</th>
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const day = idx + 1;
                  const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === todayStr;
                  const dateObj = new Date(currentYear, currentMonth - 1, day);
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                  let cellClass = '';
                  if (isToday) cellClass = 'day-cell-today';
                  else if (isWeekend) cellClass = 'day-cell-weekend';

                  return (
                    <th key={day} className={`goals-grid-th ${cellClass}`}>
                      <div>{day}</div>
                      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.6, marginTop: '2px' }}>
                        {dateObj.toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </div>
                    </th>
                  );
                })}
                <th className="goals-grid-th rate-column">Rate</th>
              </tr>
            </thead>
            <tbody>
              {goalStats.map(({ goal, createdDateStr, completionRate }) => (
                  <tr key={goal.id} className="goals-grid-tr">
                    <td className="goals-grid-td goal-column">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <span className="goal-accent-dot" />
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }} title={goal.title}>
                          <div style={{ fontWeight: 600 }}>{goal.title}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{goal.frequency}</span>
                            {goal.streak > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--accent-mood)' }}>
                                <Flame size={11} fill="var(--accent-mood)" stroke="none" /> {goal.streak}
                              </span>
                            )}
                            {freezeMode && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--accent-chat)' }} title="Streak freezes left this month">
                                <Snowflake size={11} /> {goal.freezes_remaining ?? 0}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleDelete(goal.id)}
                          title="Delete goal"
                          style={{ padding: '4px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const dateStr = dateFor(day);
                      const isToday = dateStr === todayStr;
                      const dateObj = new Date(currentYear, currentMonth - 1, day);
                      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                      const isFuture = dateStr > todayStr;
                      const isBeforeCreated = dateStr < createdDateStr;
                      const isCompleted = goal.completed_dates.includes(dateStr);
                      const isFrozen = (goal.frozen_dates || []).includes(dateStr);
                      const isMissedPast = !isFuture && !isBeforeCreated && !isCompleted && !isToday;

                      // In freeze mode only past missed days (or an already-frozen day) are clickable.
                      const disabled = freezeMode
                        ? !(isFrozen || isMissedPast)
                        : isFuture || isBeforeCreated;

                      let cellClass = '';
                      if (isFuture || isBeforeCreated) cellClass = 'day-cell-disabled';
                      else if (isFrozen) cellClass = 'day-cell-frozen';
                      else if (isToday) cellClass = 'day-cell-today';
                      else if (isWeekend) cellClass = 'day-cell-weekend';

                      return (
                        <td key={day} className={`goals-grid-td ${cellClass}`}>
                          <button
                            className={`grid-toggle-btn ${isCompleted ? 'completed' : ''} ${isFrozen ? 'frozen' : ''}`}
                            onClick={() => handleCellClick(goal.id, dateStr)}
                            disabled={disabled}
                            aria-label={`${freezeMode ? 'Freeze' : 'Toggle'} ${dateStr}`}
                            title={isFrozen ? `Streak freeze on ${dateStr}` : isCompleted ? `Completed ${dateStr}` : dateStr}
                          />
                        </td>
                      );
                    })}
                    <td className="goals-grid-td rate-column">
                      <div className="rate-cell-inner">
                        <span className="rate-cell-value" style={{ color: rateColor(completionRate) }}>{completionRate}%</span>
                        <span className="rate-bar">
                          <span className="rate-bar-fill" style={{ width: `${completionRate}%`, background: rateColor(completionRate) }} />
                        </span>
                      </div>
                    </td>
                  </tr>
              ))}
              {/* Daily totals row */}
              <tr className="goals-grid-tr totals-row">
                <td className="goals-grid-td goal-column">Daily Total</td>
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const day = idx + 1;
                  const dateStr = dateFor(day);
                  const isToday = dateStr === todayStr;
                  const dateObj = new Date(currentYear, currentMonth - 1, day);
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                  const count = goals.filter((g) => g.completed_dates.includes(dateStr)).length;

                  let cellClass = '';
                  if (dateStr > todayStr) cellClass = 'day-cell-disabled';
                  else if (isToday) cellClass = 'day-cell-today';
                  else if (isWeekend) cellClass = 'day-cell-weekend';

                  return (
                    <td key={day} className={`goals-grid-td ${cellClass}`} style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {dateStr > todayStr ? '—' : count}
                    </td>
                  );
                })}
                <td className="goals-grid-td rate-column" style={{ fontWeight: 700, color: rateColor(overallRate) }}>
                  {overallRate}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="goals-legend">
          <span className="legend-item"><span className="legend-swatch completed" /> Completed</span>
          <span className="legend-item"><span className="legend-swatch today" /> Today</span>
          <span className="legend-item"><span className="legend-swatch weekend" /> Weekend</span>
          <span className="legend-item"><span className="legend-swatch locked" /> Locked (future / before created)</span>
        </div>
        </>
      )}

      {/* Create Goal Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ fontFamily: 'var(--font-heading)' }}>Create New Goal</h3>
            <form onSubmit={handleCreate}>
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="input-label" htmlFor="goal-title">What's your goal?</label>
                <input
                  id="goal-title"
                  className="input"
                  type="text"
                  placeholder="e.g., Meditate for 10 minutes"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="input-label" htmlFor="goal-frequency">Frequency</label>
                <select
                  id="goal-frequency"
                  className="input"
                  value={newFrequency}
                  onChange={(e) => setNewFrequency(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
