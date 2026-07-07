import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import useStore from '../store/useStore';
import * as endpoints from '../api/endpoints';
import { MOOD_EMOJIS, AFFIRMATIONS } from '../utils/constants';
import { Target, Flame, Sparkles, Award, Smile, BookOpen, Calendar, Sprout, Quote } from 'lucide-react';

function SproutGrowthVisual({ completionRate, bestStreak }) {
  // Stem height: starts at 25px, grows up to 105px based on bestStreak
  const stemHeight = Math.min(105, 25 + bestStreak * 4);
  const stemTopY = 155 - stemHeight;

  return (
    <svg width="180" height="200" viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
      {/* Soil / Ground */}
      <ellipse cx="100" cy="175" rx="55" ry="10" fill="#6b4f3a" stroke="rgba(43,50,45,0.12)" strokeWidth="1.5" />

      {/* Flower Pot */}
      <path d="M 78 175 L 122 175 L 117 196 L 83 196 Z" fill="#c98a63" stroke="var(--accent-mood)" strokeWidth="2" />
      <line x1="72" y1="175" x2="128" y2="175" stroke="var(--accent-mood)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Main Stem */}
      <path
        d={`M 100 175 C 95 ${175 - stemHeight / 2} 105 ${175 - stemHeight / 1.5} 100 ${stemTopY}`}
        fill="none"
        stroke="var(--accent-goals)"
        strokeWidth="4.5"
        strokeLinecap="round"
        style={{
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Leaf 1 (Left - always present as the seedling's first leaf) */}
      <path
        d="M 100 150 C 75 150 68 142 75 132 C 90 128 98 143 100 150"
        fill="var(--accent-goals)"
        fillOpacity="0.8"
        stroke="var(--accent-goals)"
        strokeWidth="1.5"
        style={{ transformOrigin: '100px 150px', transition: 'all 0.5s ease-out' }}
      />

      {/* Leaf 2 (Right - 25% completion) */}
      {completionRate >= 0.25 && (
        <path
          d="M 100 130 C 125 130 132 122 125 112 C 110 108 102 123 100 130"
          fill="var(--accent-goals)"
          fillOpacity="0.85"
          stroke="var(--accent-goals)"
          strokeWidth="1.5"
          style={{
            transformOrigin: '100px 130px',
            transition: 'all 0.5s ease-out'
          }}
        />
      )}

      {/* Leaf 3 (Left - 50% completion) */}
      {completionRate >= 0.5 && stemHeight >= 45 && (
        <path
          d="M 100 110 C 75 110 68 102 75 92 C 90 88 98 103 100 110"
          fill="var(--accent-goals)"
          fillOpacity="0.9"
          stroke="var(--accent-goals)"
          strokeWidth="1.5"
          style={{
            transformOrigin: '100px 110px',
            transition: 'all 0.5s ease-out'
          }}
        />
      )}

      {/* Leaf 4 (Right - 75% completion) */}
      {completionRate >= 0.75 && stemHeight >= 65 && (
        <path
          d="M 100 90 C 125 90 132 82 125 72 C 110 68 102 83 100 90"
          fill="var(--accent-goals)"
          fillOpacity="0.9"
          stroke="var(--accent-goals)"
          strokeWidth="1.5"
          style={{
            transformOrigin: '100px 90px',
            transition: 'all 0.5s ease-out'
          }}
        />
      )}

      {/* Top Bloom Flower or Bud (100% completion!) */}
      {completionRate >= 1.0 ? (
        <g style={{ transformOrigin: `100px ${stemTopY}px`, animation: 'gentlePulse 2s ease-in-out infinite' }}>
          {/* Flower Petals */}
          <circle cx="100" cy={stemTopY} r="8" fill="var(--accent-mood)" />
          <circle cx="91" cy={stemTopY} r="6" fill="var(--accent-mood)" />
          <circle cx="109" cy={stemTopY} r="6" fill="var(--accent-mood)" />
          <circle cx="100" cy={stemTopY - 9} r="6" fill="var(--accent-mood)" />
          <circle cx="100" cy={stemTopY + 9} r="6" fill="var(--accent-mood)" />
          <circle cx="100" cy={stemTopY} r="4" fill="var(--text-primary)" />
        </g>
      ) : (
        /* Unbloomed Sprout Bud */
        <path
          d={`M 100 ${stemTopY} C 92 ${stemTopY - 10} 100 ${stemTopY - 15} 100 ${stemTopY} C 108 ${stemTopY - 10} 100 ${stemTopY - 15} 100 ${stemTopY}`}
          fill="var(--accent-goals)"
          stroke="var(--accent-goals)"
          strokeWidth="1"
          style={{ transition: 'all 0.5s ease-out' }}
        />
      )}
    </svg>
  );
}

export default function Dashboard() {
  const { dashboard, dashboardLoading, fetchDashboard, showToast } = useStore();
  const navigate = useNavigate();

  const [monthlyStats, setMonthlyStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    fetchMonthlyStats();
  }, []);

  const fetchMonthlyStats = async () => {
    try {
      const res = await endpoints.getMonthlyGoalStats();
      setMonthlyStats(res.data);
    } catch (err) {
      console.error('Failed to load monthly goal stats', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleCompleteGoal = async (goalId) => {
    try {
      await endpoints.completeGoal(goalId);
      fetchDashboard();
      fetchMonthlyStats();
    } catch (err) {
      showToast('Failed to update goal', 'error');
    }
  };

  if (dashboardLoading && !dashboard) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  const data = dashboard || { goals: [], habits: [], mood_trend: [], insights: [], today_stats: {} };
  const stats = data.today_stats || {};
  const completionRate = stats.goals_total > 0 ? (stats.goals_completed / stats.goals_total) : 0;
  const bestStreak = data.habits?.reduce((max, h) => Math.max(max, h.sobriety_days || 0), 0) || 0;

  const INSIGHT_LUCIDE_ICONS = {
    mood: <Smile size={16} style={{ color: 'var(--accent-mood)' }} />,
    goals: <Target size={16} style={{ color: 'var(--accent-goals)' }} />,
    urges: <Flame size={16} style={{ color: 'var(--accent-journal)' }} />,
    sentiment: <BookOpen size={16} style={{ color: 'var(--accent-chat)' }} />,
    general: <Sparkles size={16} style={{ color: 'var(--accent-goals)' }} />,
  };

  return (
    <div>
      <div className="page-header">
        <h1>Good {getGreeting()}</h1>
        <p>Here's how your journey is going today.</p>
      </div>

      {/* Daily Affirmation */}
      <div className="affirmation-card">
        <Quote size={20} style={{ color: 'var(--accent-journal)', flexShrink: 0, transform: 'scaleX(-1)' }} />
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--accent-journal)', marginBottom: '2px' }}>
            Today's Affirmation
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            {getDailyAffirmation()}
          </div>
        </div>
      </div>

      {/* Hero Growth Panel */}
      <div className="dashboard-hero-panel">
        <div className="hero-visual-container">
          <SproutGrowthVisual completionRate={completionRate} bestStreak={bestStreak} />
        </div>
        <div className="hero-stats-grid">
          <div className="hero-stat-item">
            <div className="hero-stat-value" style={{ color: 'var(--accent-goals)' }}>
              {stats.goals_completed || 0}/{stats.goals_total || 0}
            </div>
            <div className="hero-stat-label">Goals Today</div>
          </div>
          <div className="hero-stat-item">
            <div className="hero-stat-value" style={{ color: 'var(--accent-mood)' }}>
              {stats.current_mood ? `${stats.current_mood}/10` : '—'}
            </div>
            <div className="hero-stat-label">Current Mood</div>
          </div>
          <div className="hero-stat-item">
            <div className="hero-stat-value" style={{ color: 'var(--accent-journal)' }}>
              {stats.journal_entries_today || 0}
            </div>
            <div className="hero-stat-label">Journal Entries</div>
          </div>
          <div className="hero-stat-item">
            <div className="hero-stat-value" style={{ color: 'var(--accent-mood)' }}>
              {bestStreak} days
            </div>
            <div className="hero-stat-label">Best Streak</div>
          </div>
        </div>
      </div>

      {/* Monthly Statistics Heatmap Card */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} style={{ color: 'var(--accent-goals)' }} />
          <h3 className="card-title" style={{ margin: 0 }}>Monthly Progress</h3>
        </div>
        {statsLoading ? (
          <div className="flex justify-center" style={{ padding: 'var(--space-md)' }}>
            <div className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : monthlyStats ? (
          <div>
            <div className="grid-3" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
              <div className="hero-stat-item">
                <div className="hero-stat-value" style={{ color: 'var(--accent-goals)' }}>
                  {monthlyStats.overall_completion_rate}%
                </div>
                <div className="hero-stat-label">Month Completion</div>
              </div>
              <div className="hero-stat-item">
                <div className="hero-stat-value" style={{ color: 'var(--accent-mood)', fontSize: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={monthlyStats.best_goal}>
                  {monthlyStats.best_goal}
                </div>
                <div className="hero-stat-label">Best Goal ({monthlyStats.best_goal_rate}%)</div>
              </div>
              <div className="hero-stat-item">
                <div className="hero-stat-value" style={{ color: 'var(--accent-journal)' }}>
                  {monthlyStats.longest_streak} days
                </div>
                <div className="hero-stat-label">Longest Streak</div>
              </div>
            </div>

            {/* Heatmap preview */}
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)', fontWeight: 500 }}>
                Activity Heatmap (Click to view full calendar)
              </div>
              <div className="heatmap-container" onClick={() => navigate('/goals')}>
                {Object.entries(monthlyStats.heatmap || {}).map(([dateStr, rate]) => {
                  const opacity = Math.max(0.08, rate / 100);
                  return (
                    <div
                      key={dateStr}
                      className="heatmap-day"
                      style={{
                        background: `rgba(79, 122, 95, ${opacity})`,
                        border: '1px solid rgba(79, 122, 95, 0.25)',
                      }}
                      title={`${dateStr}: ${rate}% completed`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)' }}>No monthly statistics available.</p>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Today's Goals */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} style={{ color: 'var(--accent-goals)' }} />
            <h3 className="card-title">Today's Goals</h3>
          </div>
          {data.goals.length === 0 ? (
            <div className="empty-state">
              <p>No goals yet. Start by adding one!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-sm">
              {data.goals.map((goal) => (
                <div className="goal-item" key={goal.id}>
                  <button
                    className={`goal-checkbox ${goal.completed_today ? 'checked' : ''}`}
                    onClick={() => handleCompleteGoal(goal.id)}
                    aria-label={`Mark "${goal.title}" as ${goal.completed_today ? 'incomplete' : 'complete'}`}
                  />
                  <span className={`goal-title ${goal.completed_today ? 'completed' : ''}`}>
                    {goal.title}
                  </span>
                  {goal.streak > 0 && (
                    <span className="goal-streak" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Flame size={14} fill="var(--accent-mood)" stroke="none" /> {goal.streak}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Streaks */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} style={{ color: 'var(--accent-mood)' }} />
            <h3 className="card-title">Active Streaks</h3>
          </div>
          {data.habits.length === 0 ? (
            <div className="empty-state">
              <p>Track a habit to see your streaks</p>
            </div>
          ) : (
            <div className="grid-2" style={{ gap: 'var(--space-md)' }}>
              {data.habits.map((habit) => (
                <div className="streak-card" key={habit.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="streak-fire"><Sprout size={26} /></div>
                  <div className="streak-number">{habit.sobriety_days}</div>
                  <div className="streak-label">{habit.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    days strong
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mood Trend Chart */}
        <div className="card full-width">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} style={{ color: 'var(--accent-chat)' }} />
            <h3 className="card-title">Mood Trend</h3>
          </div>
          {data.mood_trend.length === 0 ? (
            <div className="empty-state">
              <p>Log your mood to see trends</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.mood_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-mood)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--accent-mood)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 10]} stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={{ stroke: 'rgba(244, 237, 224, 0.08)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.85rem',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--accent-mood)"
                  strokeWidth={2}
                  fill="url(#moodGradient)"
                  dot={{ fill: 'var(--accent-mood)', r: 4 }}
                  activeDot={{ r: 6, fill: 'var(--text-primary)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Latest Insights */}
        <div className="card full-width">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-journal)' }} />
            <h3 className="card-title">Latest Insights</h3>
          </div>
          {data.insights.length === 0 ? (
            <div className="empty-state">
              <p>Insights are generated nightly based on your activity</p>
            </div>
          ) : (
            <div className="flex flex-col gap-md">
              {data.insights.map((insight) => (
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
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getDailyAffirmation() {
  // Same affirmation all day: index by day-of-year
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  return AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];
}
