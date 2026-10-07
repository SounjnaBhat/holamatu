import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { saveProfile, UserProfile } from '../services/profileService';

export interface UserRegistrationData {
  name: string;
  phone?: string;
  location?: string;
  preferred_lang?: 'kn' | 'en';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isGuest: boolean;
  loading: boolean;
  signUpWithEmail: (email: string, password: string, data: UserRegistrationData) => Promise<{ error: any; user?: User | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<void>;
  signInWithPhone: (phone: string) => Promise<{ error: any }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: any }>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isGuest: true, // Default guest allowed for offline-first principle
  loading: true,
  signUpWithEmail: async () => ({ error: null }),
  signInWithEmail: async () => ({ error: null }),
  signInWithGoogle: async () => {},
  signInWithPhone: async () => ({ error: null }),
  verifyPhoneOtp: async () => ({ error: null }),
  continueAsGuest: () => {},
  signOut: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem('maize_advisor_guest') === 'true';
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Load initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsGuest(false);
        localStorage.removeItem('maize_advisor_guest');
      }
      setLoading(false);
    });

    // Listen to Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsGuest(false);
        localStorage.removeItem('maize_advisor_guest');
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUpWithEmail = async (email: string, password: string, registrationData: UserRegistrationData) => {
    if (!isSupabaseConfigured || !supabase) {
      // Offline-first local registration fallback
      const localId = `farmer_${Date.now()}`;
      const localProfile: UserProfile = {
        id: localId,
        name: registrationData.name || 'Farmer',
        location: registrationData.location || 'Dharwad',
        preferred_lang: registrationData.preferred_lang || 'kn',
        crop_stage: 'V4',
        soil_type: 'black',
        weather_prefs: { dToday: 60, forecastRain72h: 0 }
      };
      await saveProfile(localProfile);
      localStorage.setItem('maize_advisor_user_id', localId);
      setIsGuest(false);
      localStorage.removeItem('maize_advisor_guest');
      return { error: null, user: null };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: registrationData.name,
          phone: registrationData.phone,
          location: registrationData.location,
          preferred_lang: registrationData.preferred_lang || 'kn'
        }
      }
    });

    if (!error && data?.user) {
      setIsGuest(false);
      localStorage.removeItem('maize_advisor_guest');
      const newProfile: UserProfile = {
        id: data.user.id,
        name: registrationData.name || 'Farmer',
        location: registrationData.location || 'Dharwad',
        preferred_lang: registrationData.preferred_lang || 'kn',
        crop_stage: 'V4',
        soil_type: 'black',
        weather_prefs: { dToday: 60, forecastRain72h: 0 }
      };
      await saveProfile(newProfile);
    }

    return { error, user: data?.user ?? null };
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase credentials not configured in .env yet. You can continue as offline farmer!') };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.session) {
      setIsGuest(false);
      localStorage.removeItem('maize_advisor_guest');
    }
    return { error };
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  const signInWithPhone = async (phone: string) => {
    if (!supabase) return { error: new Error('Supabase not configured') };
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error };
  };

  const verifyPhoneOtp = async (phone: string, token: string) => {
    if (!supabase) return { error: new Error('Supabase not configured') };
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms'
    });
    if (data.session) {
      setIsGuest(false);
      localStorage.removeItem('maize_advisor_guest');
    }
    return { error };
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    localStorage.setItem('maize_advisor_guest', 'true');
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setIsGuest(true);
    localStorage.setItem('maize_advisor_guest', 'true');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isGuest,
        loading,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        signInWithPhone,
        verifyPhoneOtp,
        continueAsGuest,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
