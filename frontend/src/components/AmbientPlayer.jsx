import { useState, useRef, useEffect } from 'react';
import { Music, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';

const TRACKS = [
  { id: 'rain', label: 'Rain', file: '/audio/rain.mp3' },
  { id: 'ocean', label: 'Ocean Waves', file: '/audio/ocean.mp3' },
  { id: 'flute', label: 'Flute', file: '/audio/flute.mp3' },
  { id: 'forest', label: 'Forest', file: '/audio/forest.mp3' },
];

/**
 * Floating ambient-sound player. Rendered once at the App root (not inside
 * Layout, which remounts on every route change in this app) so playback
 * survives navigation between pages.
 */
export default function AmbientPlayer() {
  const [expanded, setExpanded] = useState(false);
  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const stored = localStorage.getItem('bloom_ambient_volume');
    return stored ? parseFloat(stored) : 0.5;
  });
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem('bloom_ambient_volume', String(volume));
  }, [volume]);

  const selectTrack = (track) => {
    if (activeTrack?.id === track.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    setActiveTrack(track);
    // Let the <audio> src update before playing.
    requestAnimationFrame(() => {
      audioRef.current?.play().catch(() => {});
      setIsPlaying(true);
    });
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 500 }}>
      {activeTrack && (
        <audio
          ref={audioRef}
          src={activeTrack.file}
          loop
          autoPlay
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {expanded && (
        <div
          className="card"
          style={{
            width: '220px',
            marginBottom: 'var(--space-sm)',
            padding: 'var(--space-md)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Ambient Sounds
            </span>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setExpanded(false)}
              aria-label="Close ambient sounds panel"
              style={{ padding: '2px' }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 'var(--space-sm)' }}>
            {TRACKS.map((track) => {
              const active = activeTrack?.id === track.id;
              return (
                <button
                  key={track.id}
                  onClick={() => selectTrack(track)}
                  className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'flex-start', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                >
                  {active && isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {track.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {volume === 0 ? <VolumeX size={16} style={{ color: 'var(--color-text-muted)' }} /> : <Volume2 size={16} style={{ color: 'var(--color-text-muted)' }} />}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{ flex: 1 }}
              aria-label="Ambient volume"
            />
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'Collapse ambient sounds' : 'Open ambient sounds'}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: 'none',
          background: activeTrack && isPlaying ? 'var(--color-sage)' : 'var(--surface)',
          color: activeTrack && isPlaying ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 'auto',
        }}
      >
        {activeTrack && isPlaying ? <Pause size={20} /> : <Music size={20} />}
      </button>
    </div>
  );
}
