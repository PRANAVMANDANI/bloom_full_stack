import { useState, useEffect } from 'react';
import * as endpoints from '../api/endpoints';
import useStore from '../store/useStore';
import { Award } from 'lucide-react';

export default function Achievements() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const showToast = useStore((s) => s.showToast);

  useEffect(() => {
    (async () => {
      try {
        const res = await endpoints.getMilestones();
        setData(res.data);
      } catch (err) {
        showToast('Failed to load achievements', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const badges = data?.badges || [];

  // Group by category, preserving definition order
  const categories = [];
  const byCategory = {};
  for (const b of badges) {
    if (!byCategory[b.category]) {
      byCategory[b.category] = [];
      categories.push(b.category);
    }
    byCategory[b.category].push(b);
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Award size={36} style={{ color: 'var(--accent-mood)', marginTop: '4px' }} />
        <div>
          <h1 style={{ margin: '0 0 var(--space-xs)' }}>Achievements</h1>
          <p style={{ margin: 0 }}>
            Milestones you've earned along the way. {data ? `${data.achieved_count} of ${data.total_count} unlocked.` : ''}
          </p>
        </div>
      </div>

      {data && (
        <div className="achievement-progress-bar" style={{ marginBottom: 'var(--space-xl)' }}>
          <div
            className="achievement-progress-fill"
            style={{ width: `${data.total_count ? (data.achieved_count / data.total_count) * 100 : 0}%` }}
          />
        </div>
      )}

      <div className="flex flex-col gap-xl">
        {categories.map((cat) => (
          <div key={cat}>
            <h3 style={{
              fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)',
              textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-body)', fontWeight: 600,
            }}>
              {cat}
            </h3>
            <div className="badge-grid">
              {byCategory[cat].map((b) => (
                <div key={b.id} className={`badge-card ${b.achieved ? 'achieved' : 'locked'}`} title={b.description}>
                  <div className="badge-emoji">{b.emoji}</div>
                  <div className="badge-title">{b.title}</div>
                  <div className="badge-desc">{b.description}</div>
                  {b.achieved ? (
                    <div className="badge-status earned">Earned ✓</div>
                  ) : (
                    <div className="badge-progress-wrap">
                      <div className="badge-progress-track">
                        <div className="badge-progress-fill" style={{ width: `${b.progress * 100}%` }} />
                      </div>
                      <span className="badge-progress-label">{b.current} / {b.target}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
