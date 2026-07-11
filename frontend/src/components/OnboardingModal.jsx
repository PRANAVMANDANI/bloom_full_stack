import { useState } from 'react';
import useStore from '../store/useStore';
import * as endpoints from '../api/endpoints';

export default function OnboardingModal() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const showToast = useStore((s) => s.showToast);

  const [birthday, setBirthday] = useState('');
  const [focusArea, setFocusArea] = useState('General Self-Improvement & Anxiety');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const calculateAge = (birthDateStr) => {
    if (!birthDateStr) return null;
    const today = new Date();
    const birthDate = new Date(birthDateStr);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? age : null;
  };

  // Determine if profile needs onboarding
  const needsOnboarding = user && (!user.profile || !user.profile.focus_area || !user.profile.birthday);

  if (!needsOnboarding) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!birthday) {
      alert("Please enter your birthday.");
      return;
    }
    const calculatedAge = calculateAge(birthday);
    if (!calculatedAge || calculatedAge <= 0) {
      alert("Please enter a valid birthday.");
      return;
    }
    setLoading(true);
    try {
      const res = await endpoints.updateProfile({
        birthday: birthday || null,
        age: calculatedAge,
        focus_area: focusArea,
        additional_details: additionalDetails || null,
      });
      setUser(res.data);
      showToast("Profile set up successfully! Welcome to BLOOM.");
    } catch (err) {
      console.error(err);
      showToast("Failed to save profile. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal" style={{ maxWidth: '500px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          Personalize Your Journey
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Bloom uses these details to personalize its responses, help you track relevant recovery patterns, and support you contextually.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>
              Birthday
            </label>
            <input
              type="date"
              className="input"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              required
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>
              Primary Recovery / Growth Focus
            </label>
            <select
              className="input"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <option value="Quit Smoking / Nicotine">Quit Smoking / Nicotine</option>
              <option value="Quit Alcohol">Quit Alcohol</option>
              <option value="Quit Substance Abuse">Quit Substance Abuse</option>
              <option value="Reduce Screen Time / Gaming">Reduce Screen Time / Gaming</option>
              <option value="General Self-Improvement & Anxiety">General Self-Improvement & Anxiety</option>
              <option value="Build Positive Daily Habits">Build Positive Daily Habits</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>
              Recovery Notes / Context for Bloom (Optional)
            </label>
            <textarea
              className="input"
              placeholder="e.g., I want to stop smoking because of my health and fitness goals. I usually get triggers under stress..."
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              style={{ width: '100%', minHeight: '80px', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: 'var(--space-md)' }}>
            <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ padding: '0.8rem' }}>
              {loading ? "Saving profile..." : "Start Journey"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
