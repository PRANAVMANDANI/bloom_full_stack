import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Target,
  Flame,
  Smile,
  BookOpen,
  MessageCircle,
  Wind,
  Sparkles,
  LayoutDashboard,
  Moon,
  Sun,
  ArrowRight,
  Leaf,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react';
import useStore from '../store/useStore';
import { AFFIRMATIONS, CRISIS_RESOURCES } from '../utils/constants';

/* A fuller version of the dashboard sprout, used as the hero illustration. */
function HeroSprout() {
  return (
    <svg
      className="lp-hero-plant"
      width="320"
      height="360"
      viewBox="0 0 200 220"
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* Soft halo */}
      <circle cx="100" cy="96" r="92" fill="var(--color-sage-dim)" />

      {/* Soil / Ground */}
      <ellipse cx="100" cy="192" rx="60" ry="11" fill="#6b4f3a" stroke="rgba(43,50,45,0.12)" strokeWidth="1.5" />

      {/* Flower Pot */}
      <path d="M 76 192 L 124 192 L 118 214 L 82 214 Z" fill="#c98a63" stroke="var(--accent-mood)" strokeWidth="2" />
      <line x1="70" y1="192" x2="130" y2="192" stroke="var(--accent-mood)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Main Stem */}
      <path
        d="M 100 192 C 95 150 105 110 100 60"
        fill="none"
        stroke="var(--accent-goals)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Leaves */}
      <path d="M 100 165 C 74 165 66 156 74 145 C 90 141 98 158 100 165" fill="var(--accent-goals)" fillOpacity="0.8" stroke="var(--accent-goals)" strokeWidth="1.5" />
      <path d="M 100 142 C 126 142 134 133 126 122 C 110 118 102 135 100 142" fill="var(--accent-goals)" fillOpacity="0.85" stroke="var(--accent-goals)" strokeWidth="1.5" />
      <path d="M 100 118 C 74 118 66 109 74 98 C 90 94 98 111 100 118" fill="var(--accent-goals)" fillOpacity="0.9" stroke="var(--accent-goals)" strokeWidth="1.5" />
      <path d="M 100 94 C 126 94 134 85 126 74 C 110 70 102 87 100 94" fill="var(--accent-goals)" fillOpacity="0.9" stroke="var(--accent-goals)" strokeWidth="1.5" />

      {/* Top Bloom */}
      <g style={{ transformOrigin: '100px 60px', animation: 'gentlePulse 2.6s ease-in-out infinite' }}>
        <circle cx="100" cy="60" r="9" fill="var(--accent-mood)" />
        <circle cx="90" cy="60" r="6.5" fill="var(--accent-mood)" />
        <circle cx="110" cy="60" r="6.5" fill="var(--accent-mood)" />
        <circle cx="100" cy="50" r="6.5" fill="var(--accent-mood)" />
        <circle cx="100" cy="70" r="6.5" fill="var(--accent-mood)" />
        <circle cx="100" cy="60" r="4.5" fill="var(--surface)" />
      </g>

      {/* Floating accent petals */}
      <circle className="lp-drift lp-drift-1" cx="40" cy="70" r="4" fill="var(--accent-journal)" fillOpacity="0.5" />
      <circle className="lp-drift lp-drift-2" cx="164" cy="110" r="3.5" fill="var(--accent-chat)" fillOpacity="0.5" />
      <circle className="lp-drift lp-drift-3" cx="150" cy="46" r="3" fill="var(--accent-mood)" fillOpacity="0.5" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: <LayoutDashboard size={22} />,
    color: 'var(--accent-goals)',
    dim: 'var(--color-sage-dim)',
    title: 'A garden that grows with you',
    body: 'Your dashboard sprout grows taller with every day of your longest streak and blooms as you complete each day’s practices.',
  },
  {
    icon: <Target size={22} />,
    color: 'var(--accent-goals)',
    dim: 'var(--color-sage-dim)',
    title: 'Daily goals',
    body: 'Break your journey into small, repeatable practices and check them off on a calm month-at-a-glance grid.',
  },
  {
    icon: <Flame size={22} />,
    color: 'var(--accent-mood)',
    dim: 'var(--color-peach-dim)',
    title: 'Habit & streak tracking',
    body: 'Track the habits you’re building — or breaking — and watch your day count climb, one day at a time.',
  },
  {
    icon: <Smile size={22} />,
    color: 'var(--accent-mood)',
    dim: 'var(--color-peach-dim)',
    title: 'Mood check-ins',
    body: 'A quick daily pulse on how you feel, with tags and triggers, so patterns become visible over time.',
  },
  {
    icon: <BookOpen size={22} />,
    color: 'var(--accent-journal)',
    dim: 'var(--color-lavender-dim)',
    title: 'Guided journaling',
    body: 'Thoughtful prompts help you reflect when the blank page feels like too much.',
  },
  {
    icon: <MessageCircle size={22} />,
    color: 'var(--accent-chat)',
    dim: 'var(--color-sky-dim)',
    title: 'A companion to talk to',
    body: 'A gentle, always-available chat for the moments between check-ins when you just need to be heard.',
  },
  {
    icon: <Wind size={22} />,
    color: 'var(--accent-chat)',
    dim: 'var(--color-sky-dim)',
    title: 'Breathe',
    body: 'Guided breathing to steady yourself when an urge, a craving, or a hard moment arrives.',
  },
  {
    icon: <Sparkles size={22} />,
    color: 'var(--accent-journal)',
    dim: 'var(--color-lavender-dim)',
    title: 'Insights',
    body: 'Quiet, personal patterns drawn from your moods, goals, and entries — never judgment, only reflection.',
  },
];

export default function Landing() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const navigate = useNavigate();

  // Signed-in visitors skip the marketing page and go straight to their garden.
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const affirmation = AFFIRMATIONS[new Date().getDate() % AFFIRMATIONS.length];

  return (
    <div className="lp-page">
      {/* --- Top navigation --- */}
      <header className="lp-nav">
        <span className="lp-brand">
          <Leaf size={22} strokeWidth={2.2} /> BLOOM
        </span>
        <div className="lp-nav-actions">
          <button
            className="lp-icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link to="/login" className="btn btn-ghost">Log in</Link>
          <Link to="/signup" className="btn btn-primary">Get started</Link>
        </div>
      </header>

      {/* --- Hero --- */}
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">
            <HeartHandshake size={15} /> Your gentle recovery companion
          </span>
          <h1 className="lp-title">
            Grow through what<br />you go through.
          </h1>
          <p className="lp-subtitle">
            BLOOM is a calm, private space for building better days — track goals and
            habits, check in with your mood, journal your thoughts, and breathe through
            the hard moments. Progress, not perfection.
          </p>
          <div className="lp-cta-row">
            <Link to="/signup" className="btn btn-primary btn-lg">
              Start your journey <ArrowRight size={17} />
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              I already have an account
            </Link>
          </div>
          <p className="lp-reassure">
            <ShieldCheck size={14} /> Private by design · Free to begin · One day at a time
          </p>
        </div>
        <div className="lp-hero-art">
          <HeroSprout />
        </div>
      </section>

      {/* --- Affirmation strip --- */}
      <section className="lp-affirmation">
        <span className="lp-quote-mark">“</span>
        {affirmation}
      </section>

      {/* --- Features --- */}
      <section className="lp-features" id="features">
        <div className="lp-section-head">
          <h2 className="lp-section-title">Everything you need to keep going</h2>
          <p className="lp-section-sub">
            Small, supportive tools that add up — because healing is not linear, and
            that is completely okay.
          </p>
        </div>
        <div className="lp-feature-grid">
          {FEATURES.map((f) => (
            <article className="lp-feature-card" key={f.title}>
              <span className="lp-feature-icon" style={{ background: f.dim, color: f.color }}>
                {f.icon}
              </span>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-body">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* --- How it works --- */}
      <section className="lp-steps">
        <div className="lp-section-head">
          <h2 className="lp-section-title">How BLOOM works</h2>
        </div>
        <div className="lp-step-row">
          <div className="lp-step">
            <span className="lp-step-num">1</span>
            <h3 className="lp-feature-title">Plant your intentions</h3>
            <p className="lp-feature-body">Set a few small daily goals and the habits you want to nurture.</p>
          </div>
          <div className="lp-step">
            <span className="lp-step-num">2</span>
            <h3 className="lp-feature-title">Show up, one day at a time</h3>
            <p className="lp-feature-body">Check in, journal, breathe. Every small step counts — even the quiet ones.</p>
          </div>
          <div className="lp-step">
            <span className="lp-step-num">3</span>
            <h3 className="lp-feature-title">Watch yourself bloom</h3>
            <p className="lp-feature-body">Streaks grow, patterns surface, and your garden flowers as you do.</p>
          </div>
        </div>
      </section>

      {/* --- Closing CTA --- */}
      <section className="lp-final-cta">
        <div className="lp-final-inner">
          <Leaf size={30} strokeWidth={2} className="lp-final-leaf" />
          <h2 className="lp-final-title">The best day to begin is today.</h2>
          <p className="lp-final-sub">
            Showing up is already a victory. Create your free account and take the first step.
          </p>
          <Link to="/signup" className="btn btn-primary btn-lg">
            Create your free account <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <Leaf size={18} /> BLOOM
        </div>
        <p className="lp-footer-disclaimer">{CRISIS_RESOURCES.disclaimer}</p>
        <div className="lp-footer-links">
          <Link to="/login">Log in</Link>
          <Link to="/signup">Get started</Link>
          <a href={CRISIS_RESOURCES.website} target="_blank" rel="noreferrer">Crisis resources</a>
        </div>
        <p className="lp-footer-fine">© {new Date().getFullYear()} BLOOM · Made with care.</p>
      </footer>
    </div>
  );
}
