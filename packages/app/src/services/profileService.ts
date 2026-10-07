import { openDB, enqueueSync } from './syncQueue';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface UserProfile {
  id: string;
  name: string;
  location: string;
  preferred_lang: 'kn' | 'en';
  crop_stage: string;
  soil_type: string;
  weather_prefs?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'local_farmer',
  name: 'Karnataka Farmer',
  location: 'Dharwad',
  preferred_lang: 'kn',
  crop_stage: 'V4',
  soil_type: 'black',
  weather_prefs: { dToday: 60, forecastRain72h: 0 }
};

export async function getLocalProfile(userId: string = 'local_farmer'): Promise<UserProfile> {
  try {
    const db = await openDB();
    const tx = db.transaction(['profiles'], 'readonly');
    const store = tx.objectStore('profiles');
    const req = store.get(userId);

    const profile = await new Promise<UserProfile | null>((res, rej) => {
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });

    if (profile) return profile;
  } catch (err) {
    console.warn('Could not load profile from IndexedDB:', err);
  }

  // Fall back to default profile
  return { ...DEFAULT_PROFILE, id: userId };
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  const updated: UserProfile = {
    ...profile,
    updated_at: new Date().toISOString()
  };

  // 1. Write to local IndexedDB first (Fast & offline-ready)
  try {
    const db = await openDB();
    const tx = db.transaction(['profiles'], 'readwrite');
    tx.objectStore('profiles').put(updated);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save profile to IndexedDB:', err);
  }

  // 2. Queue for cloud sync (Non-blocking)
  enqueueSync('profiles', 'upsert', updated).catch(err => {
    console.warn('Profile sync enqueue warning:', err);
  });

  return updated;
}

export async function hydrateProfileFromCloud(userId: string): Promise<UserProfile | null> {
  if (!navigator.onLine || !isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    // Save fetched profile into IndexedDB locally
    const db = await openDB();
    const tx = db.transaction(['profiles'], 'readwrite');
    tx.objectStore('profiles').put(data);
    return data as UserProfile;
  } catch (err) {
    return null;
  }
}
