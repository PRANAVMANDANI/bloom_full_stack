import { useState } from 'react';
import * as endpoints from '../api/endpoints';
import useStore from '../store/useStore';
import {
  Settings as SettingsIcon,
  User,
  UserCheck,
  Download,
  Save,
  Lock,
  KeyRound,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

export default function Settings() {
  const [exporting, setExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const { user, setUser, logout, showToast } = useStore();
  
  const profile = user?.profile || {};
  const [birthday, setBirthday] = useState(profile.birthday || '');
  const [age, setAge] = useState(profile.age || '');
  const [focusArea, setFocusArea] = useState(profile.focus_area || 'General Self-Improvement & Anxiety');
  const [additionalDetails, setAdditionalDetails] = useState(profile.additional_details || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      await endpoints.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully 🔒');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!age || isNaN(age) || parseInt(age) <= 0) {
      showToast('Please enter a valid age.', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await endpoints.updateProfile({
        birthday: birthday || null,
        age: parseInt(age),
        focus_area: focusArea,
        additional_details: additionalDetails || null,
      });
      setUser(res.data);
      showToast('Profile demographics updated! 🌱');
    } catch (err) {
      showToast('Failed to update profile details', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await endpoints.exportData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bloom_export_${user?.email || 'data'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Data exported successfully');
    } catch (err) {
      showToast('Failed to export data', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await endpoints.deleteAccount();
      showToast('Account deleted. Take care.');
      logout();
    } catch (err) {
      showToast('Failed to delete account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <SettingsIcon size={36} style={{ color: 'var(--accent-goals)', marginTop: '4px' }} />
        <div>
          <h1 style={{ margin: '0 0 var(--space-xs)' }}>Settings</h1>
          <p style={{ margin: 0 }}>Manage your account and data.</p>
        </div>
      </div>

      {/* Account Info */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={18} style={{ color: 'var(--accent-goals)' }} />
          <h3 className="card-title" style={{ margin: 0 }}>Account</h3>
        </div>
        <div className="flex flex-col gap-md">
          <div>
            <div className="text-sm text-muted">Name</div>
            <div style={{ fontWeight: 500 }}>{user?.name || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Email</div>
            <div style={{ fontWeight: 500 }}>{user?.email || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Member since</div>
            <div style={{ fontWeight: 500 }}>
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Demographics */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={18} style={{ color: 'var(--accent-goals)' }} />
          <h3 className="card-title" style={{ margin: 0 }}>Demographics & Recovery Profile</h3>
        </div>
        <p style={{ marginBottom: 'var(--space-md)', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
          Help Bloom personalize its companion dialogue, insights, and suggestions for you.
        </p>
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 500 }}>Age</label>
              <input
                className="input"
                type="number"
                placeholder="e.g. 24"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 500 }}>Birthday</label>
              <input
                className="input"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" style={{ fontWeight: 500 }}>Primary Recovery / Growth Focus</label>
            <select
              className="input"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              style={{ width: '100%', background: 'var(--color-bg-input)', paddingRight: '2rem' }}
            >
              <option value="Quit Smoking / Nicotine">Quit Smoking / Nicotine</option>
              <option value="Quit Alcohol">Quit Alcohol</option>
              <option value="Quit Substance Abuse">Quit Substance Abuse</option>
              <option value="Reduce Screen Time / Gaming">Reduce Screen Time / Gaming</option>
              <option value="General Self-Improvement & Anxiety">General Self-Improvement & Anxiety</option>
              <option value="Build Positive Daily Habits">Build Positive Daily Habits</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" style={{ fontWeight: 500 }}>Recovery Notes / Context for Bloom</label>
            <textarea
              className="input"
              placeholder="Tell Bloom about your triggers, long term goals, or coping mechanisms..."
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              style={{ minHeight: '80px', borderRadius: 'var(--radius-md)', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginTop: 'var(--space-sm)' }}>
            <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} /> {savingProfile ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={18} style={{ color: 'var(--accent-goals)' }} />
          <h3 className="card-title" style={{ margin: 0 }}>Change Password</h3>
        </div>
        {user?.auth_provider === 'google' ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            You signed in with Google, so there's no password to change here. Manage your account security
            directly through your Google account instead.
          </p>
        ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '0.65rem 0.9rem', marginBottom: 'var(--space-md)',
            background: 'var(--color-rose-dim)', border: '1px solid rgba(189, 93, 93, 0.3)',
            borderRadius: 'var(--radius-md)', color: 'var(--color-rose)', fontSize: '0.85rem',
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            This only works for accounts using email/password sign-in. If you signed in with Google,
            this won't work — there's no password on file to change.
          </div>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', maxWidth: '420px' }}>
          <div className="input-group">
            <label className="input-label" htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="grid-2" style={{ gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label" htmlFor="new-password">New password</label>
              <input
                id="new-password"
                className="input"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                className="input"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={changingPassword} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <KeyRound size={16} /> {changingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
        </>
        )}
      </div>

      {/* Data Export */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={18} style={{ color: 'var(--accent-goals)' }} />
          <h3 className="card-title" style={{ margin: 0 }}>Export Your Data</h3>
        </div>
        <p style={{ marginBottom: 'var(--space-lg)', fontSize: '0.9rem' }}>
          Download all your data (goals, habits, mood logs, journal entries, chat messages, and insights) as a JSON file.
          Your data belongs to you.
        </p>
        <button className="btn btn-secondary" onClick={handleExport} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Download size={16} /> {exporting ? 'Exporting...' : 'Download My Data'}
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={18} style={{ color: 'var(--accent-goals)' }} />
          <h3 className="card-title" style={{ margin: 0 }}>Privacy</h3>
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <p>• Your data is stored securely and never shared with third parties</p>
          <p style={{ marginTop: '0.5rem' }}>• Chat messages are processed by an AI model but are not used for training</p>
          <p style={{ marginTop: '0.5rem' }}>• You can export or delete all your data at any time</p>
          <p style={{ marginTop: '0.5rem' }}>• Sensitive collections are only accessible via authenticated endpoints</p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ borderColor: 'rgba(224, 122, 122, 0.3)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-rose)' }} />
          <h3 className="card-title" style={{ color: 'var(--color-rose)', margin: 0 }}>Danger Zone</h3>
        </div>
        <p style={{ marginBottom: 'var(--space-lg)', fontSize: '0.9rem' }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Trash2 size={16} /> Delete My Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-rose)', fontFamily: 'var(--font-heading)' }}>
              <AlertTriangle size={20} /> Delete Account
            </h3>
            <p style={{ marginBottom: 'var(--space-lg)', fontSize: '0.9rem', lineHeight: 1.7 }}>
              This will permanently delete your account and <strong>all your data</strong> including
              goals, habits, mood logs, journal entries, chat messages, and insights.
              <br /><br />
              This action <strong>cannot be undone</strong>.
            </p>
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="input-label">Type DELETE to confirm</label>
              <input
                className="input"
                type="text"
                placeholder="DELETE"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
