import React, { useState, useEffect } from 'react';
import { getLocalProfile, saveProfile, UserProfile } from '../services/profileService';
import { getPendingSyncCount, subscribeSyncStatus, flushSyncQueue } from '../services/syncQueue';
import { useAuth } from '../contexts/AuthContext';

interface ProfileTabProps {
  lang?: 'kn' | 'en';
  onProfileUpdated?: (updated: UserProfile) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ lang = 'kn', onProfileUpdated }) => {
  const { user, isGuest, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({
    id: user?.id || 'local_farmer',
    name: 'Karnataka Farmer',
    location: 'Dharwad',
    preferred_lang: lang,
    crop_stage: 'V4',
    soil_type: 'black'
  });

  const [isEditing, setIsEditing] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadProfileData();
    const unsubscribe = subscribeSyncStatus(() => {
      checkSyncStatus();
    });
    return () => unsubscribe();
  }, []);

  const loadProfileData = async () => {
    const data = await getLocalProfile(user?.id || 'local_farmer');
    setProfile(data);
    checkSyncStatus();
  };

  const checkSyncStatus = async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await saveProfile(profile);
    setProfile(updated);
    setIsEditing(false);
    if (onProfileUpdated) onProfileUpdated(updated);
    checkSyncStatus();
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await flushSyncQueue();
    await checkSyncStatus();
    setIsSyncing(false);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header card */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--surface-card, #ffffff) 0%, var(--surface-sunk, #f8fafc) 100%)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 'var(--radius-card, 16px)',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent, #22c55e)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px'
          }}
        >
          👨‍🌾
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{profile.name}</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', marginTop: '2px' }}>
            📍 {profile.location} District • {profile.soil_type === 'black' ? 'Black Soil (ಕಪ್ಪು ಮಣ್ಣು)' : 'Red Soil (ಕೆಂಪು ಮಣ್ಣು)'}
          </div>
        </div>
      </div>

      {/* Sync Status Badge */}
      <div
        style={{
          background: pendingCount > 0 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
          border: `1px solid ${pendingCount > 0 ? '#eab308' : '#22c55e'}`,
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>{pendingCount > 0 ? '⏳' : '✅'}</span>
          <div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary, #1e293b)' }}>
              {pendingCount > 0
                ? `${pendingCount} items waiting to sync`
                : 'All field data synced'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)' }}>
              {pendingCount > 0
                ? 'Will sync automatically when connected to internet'
                : 'Stored safely in local IndexedDB + Supabase'}
            </div>
          </div>
        </div>
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          style={{
            background: 'var(--surface-card, #ffffff)',
            border: '1px solid var(--border, #cbd5e1)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Profile Details Card */}
      <div
        style={{
          background: 'var(--surface-card, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 'var(--radius-card, 16px)',
          padding: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
            {lang === 'kn' ? 'ಜಮೀನು ವಿವರಗಳು' : 'Field Profile Details'}
          </h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent, #22c55e)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', fontWeight: '500' }}>Farmer Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #cbd5e1)',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', fontWeight: '500' }}>District / Location</label>
              <input
                type="text"
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #cbd5e1)',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', fontWeight: '500' }}>Crop Stage</label>
              <select
                value={profile.crop_stage}
                onChange={(e) => setProfile({ ...profile, crop_stage: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #cbd5e1)',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Sowing">Sowing (ಬಿತ್ತನೆ)</option>
                <option value="V4">V4 Vegetative (30 days)</option>
                <option value="VT">VT Flowering / Tasseling (ಹೂವು)</option>
                <option value="Yield">Yield / Cob Formation (ಕಾಳು)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', fontWeight: '500' }}>Soil Type</label>
              <select
                value={profile.soil_type}
                onChange={(e) => setProfile({ ...profile, soil_type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #cbd5e1)',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="black">Medium Black Soil (ಕಪ್ಪು ಮಣ್ಣು)</option>
                <option value="red">Red Sandy Soil (ಕೆಂಪು ಮಣ್ಣು)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent, #22c55e)',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'transparent',
                  color: 'var(--text-secondary, #64748b)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border, #f1f5f9)' }}>
              <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '13px' }}>Location / Taluk:</span>
              <span style={{ fontWeight: '600', fontSize: '13px' }}>{profile.location}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border, #f1f5f9)' }}>
              <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '13px' }}>Current Crop Stage:</span>
              <span style={{ fontWeight: '600', fontSize: '13px' }}>{profile.crop_stage}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border, #f1f5f9)' }}>
              <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '13px' }}>Soil Type:</span>
              <span style={{ fontWeight: '600', fontSize: '13px' }}>{profile.soil_type}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '13px' }}>Rule Engine Mode:</span>
              <span style={{ fontWeight: '600', fontSize: '13px', color: '#22c55e' }}>⚡ Offline-First (Deterministic)</span>
            </div>
          </div>
        )}
      </div>

      {/* Auth / Account Card */}
      <div
        style={{
          background: 'var(--surface-card, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 'var(--radius-card, 16px)',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600' }}>
            Account Mode: {isGuest ? 'Offline Guest' : user?.email || user?.phone || 'Authenticated'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
            {isGuest ? 'Using local storage' : 'Cloud sync active'}
          </div>
        </div>
        <button
          onClick={signOut}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          {isGuest ? 'Login / Signup' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
};
