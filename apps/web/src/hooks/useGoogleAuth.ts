// ─── useGoogleAuth ────────────────────────────────────────────────────────────
//
// Wraps driveService auth.
// • Calls initGoogleAuth once on mount (after GIS script loads).
// • Exposes { isAuthed, user, signIn, signOut, isLoading, error }.
// • Token persistence is handled inside driveService (localStorage).

import { useState, useEffect, useCallback } from 'react';
import {
  initGoogleAuth,
  signIn as dsSignIn,
  signOut as dsSignOut,
  isAuthenticated,
  getStoredUser,
  type DriveUser,
} from '../../../../packages/core/src/sync/driveService';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export interface GoogleAuthState {
  isAuthed: boolean;
  isLoading: boolean;
  user: DriveUser | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
}

export function useGoogleAuth(): GoogleAuthState {
  const [isAuthed,   setIsAuthed]   = useState(false);
  const [isLoading,  setIsLoading]  = useState(true);
  const [user,       setUser]       = useState<DriveUser | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // Initialise on mount
  useEffect(() => {
    if (!CLIENT_ID) {
      setError('VITE_GOOGLE_CLIENT_ID is not set.');
      setIsLoading(false);
      return;
    }

    initGoogleAuth(CLIENT_ID)
      .then(() => {
        // Restore session from localStorage if token is still valid
        if (isAuthenticated()) {
          const stored = getStoredUser();
          setUser(stored);
          setIsAuthed(true);
        }
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSignIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const u = await dsSignIn();
      setUser(u);
      setIsAuthed(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      setError(msg);
      setIsAuthed(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(() => {
    dsSignOut();
    setUser(null);
    setIsAuthed(false);
  }, []);

  return {
    isAuthed,
    isLoading,
    user,
    error,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };
}
