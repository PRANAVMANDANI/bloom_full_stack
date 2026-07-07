import { useState, useEffect, useRef } from 'react';
import { Wind, Play, Square } from 'lucide-react';

// Each technique is a repeating cycle of phases with durations in seconds.
const TECHNIQUES = {
  box: {
    name: 'Box Breathing',
    description: 'Inhale, hold, exhale, hold — 4 seconds each. Used to calm the nervous system under stress.',
    phases: [
      { label: 'Breathe in', duration: 4, scale: 1 },
      { label: 'Hold', duration: 4, scale: 1 },
      { label: 'Breathe out', duration: 4, scale: 0.55 },
      { label: 'Hold', duration: 4, scale: 0.55 },
    ],
  },
  relax: {
    name: '4-7-8 Relax',
    description: 'Inhale for 4, hold for 7, exhale slowly for 8. Great for winding down or riding out an urge.',
    phases: [
      { label: 'Breathe in', duration: 4, scale: 1 },
      { label: 'Hold', duration: 7, scale: 1 },
      { label: 'Breathe out', duration: 8, scale: 0.55 },
    ],
  },
  simple: {
    name: 'Simple Deep',
    description: 'A gentle 5-second inhale and 5-second exhale. The easiest place to start.',
    phases: [
      { label: 'Breathe in', duration: 5, scale: 1 },
      { label: 'Breathe out', duration: 5, scale: 0.55 },
    ],
  },
};

export default function Breathe() {
  const [technique, setTechnique] = useState('box');
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(TECHNIQUES.box.phases[0].duration);
  const [cycles, setCycles] = useState(0);
  const timerRef = useRef(null);

  const phases = TECHNIQUES[technique].phases;
  const phase = phases[phaseIdx];

  // Reset when technique changes or exercise stops
  const reset = (tech = technique) => {
    clearInterval(timerRef.current);
    setRunning(false);
    setPhaseIdx(0);
    setSecondsLeft(TECHNIQUES[tech].phases[0].duration);
    setCycles(0);
  };

  const handleTechniqueChange = (key) => {
    setTechnique(key);
    reset(key);
  };

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // Advance to the next phase
        setPhaseIdx((idx) => {
          const next = (idx + 1) % phases.length;
          if (next === 0) setCycles((c) => c + 1);
          return next;
        });
        return 0; // replaced immediately by the phase-change effect below
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running, phases.length]);

  // When the phase changes, load its duration
  useEffect(() => {
    if (running) setSecondsLeft(phases[phaseIdx].duration);
  }, [phaseIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const circleScale = running ? phase.scale : 0.75;
  const transitionSeconds = running ? phase.duration : 0.4;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Wind size={36} style={{ color: 'var(--accent-chat)', marginTop: '4px' }} />
        <div>
          <h1 style={{ margin: '0 0 var(--space-xs)' }}>Breathe</h1>
          <p style={{ margin: 0 }}>A minute of slow breathing can soften an urge or a stressful moment. Try it now.</p>
        </div>
      </div>

      {/* Technique selector */}
      <div className="tag-group" style={{ marginBottom: 'var(--space-xl)' }}>
        {Object.entries(TECHNIQUES).map(([key, t]) => (
          <span
            key={key}
            className={`tag ${technique === key ? 'tag-sage active' : 'tag-sky'}`}
            onClick={() => handleTechniqueChange(key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleTechniqueChange(key)}
          >
            {t.name}
          </span>
        ))}
      </div>

      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <p style={{ maxWidth: '460px', margin: '0 auto var(--space-xl)', fontSize: '0.95rem' }}>
          {TECHNIQUES[technique].description}
        </p>

        {/* Breathing circle */}
        <div className="breathe-stage">
          <div
            className="breathe-circle"
            style={{
              transform: `scale(${circleScale})`,
              transition: `transform ${transitionSeconds}s ease-in-out`,
            }}
          />
          <div className="breathe-label">
            {running ? (
              <>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600 }}>
                  {phase.label}
                </div>
                <div style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-chat)' }}>
                  {secondsLeft}
                </div>
              </>
            ) : (
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: 'var(--color-text-secondary)' }}>
                Ready when you are
              </div>
            )}
          </div>
        </div>

        {cycles > 0 && (
          <p style={{ marginTop: 'var(--space-md)', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {cycles} full cycle{cycles !== 1 ? 's' : ''} completed 🌿
          </p>
        )}

        <div style={{ marginTop: 'var(--space-xl)' }}>
          {running ? (
            <button className="btn btn-secondary btn-lg" onClick={() => reset()} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Square size={16} /> Stop
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={() => setRunning(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Play size={16} /> Start Breathing
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Why this helps</h3>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
          Slow, controlled breathing activates the parasympathetic nervous system — the body's natural "calm down" signal.
          Urges and anxious moments usually peak and pass within a few minutes, and focusing on your breath gives them a chance
          to pass without acting on them. If an urge feels overwhelming, try one round of breathing, then log it in the
          Habit Tracker — naming it takes away some of its power.
        </p>
      </div>
    </div>
  );
}
