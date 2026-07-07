import { CRISIS_RESOURCES } from '../utils/constants';
import { ShieldAlert } from 'lucide-react';

export default function CrisisDisclaimer() {
  return (
    <div className="crisis-disclaimer" role="alert" aria-label="Crisis support information">
      <ShieldAlert size={18} style={{ color: 'var(--accent-mood)', flexShrink: 0, marginTop: '2px' }} />
      <div>
        <strong>{CRISIS_RESOURCES.disclaimer}</strong>
      </div>
    </div>
  );
}
