import { createContext, useContext, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import type { User } from '@shared/schema';
import { apiUrl } from '@/lib/api';
import {
  registerPushNotifications,
  unregisterPushNotifications,
} from '@/lib/pushNotifications';

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  daycareId: number | null;
  passwordNeedsReset?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  isAuthenticated: boolean;
  needsPasswordChange: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Read the stored session before the first render.
 *
 * This used to happen in an effect, so the first render always reported "not
 * signed in". ProtectedRoute reacted by redirecting to "/", which discarded the
 * path the browser had actually asked for -- so refreshing the page anywhere,
 * following a bookmark, or opening a link to a specific screen all dropped the
 * user on the dashboard instead. Reading synchronously means the very first render
 * already knows who is signed in.
 *
 * localStorage can throw (private browsing, site data blocked) and can hold
 * malformed JSON from an older version, so a failure here is treated as "signed
 * out" rather than crashing the application at boot.
 */
function readStoredSession(): { user: AuthUser | null; token: string | null } {
  try {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (!storedUser || !storedToken) return { user: null, token: null };
    return { user: JSON.parse(storedUser) as AuthUser, token: storedToken };
  } catch {
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(readStoredSession);
  const [user, setUser] = useState<AuthUser | null>(stored.user);
  const [token, setToken] = useState<string | null>(stored.token);
  const [, setLocation] = useLocation();

  const login = (user: AuthUser, token: string) => {
    setUser(user);
    setToken(token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);

    // Register the device for notifications now that there is a session to attach
    // the token to. On the web this does nothing. It is deliberately not awaited:
    // signing in must not wait on a permission prompt, and a device that declines
    // notifications still signs in normally.
    void registerPushNotifications();
  };

  const logout = async () => {
    // Stop notifications for this device first: removing the push token is an
    // authenticated request, so it has to happen while the session is still valid.
    // Otherwise the token stays registered to the account that just signed out and
    // the next person on a shared device keeps receiving its notifications.
    await unregisterPushNotifications(token);

    // Call logout API to invalidate session token on server
    if (token) {
      try {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Logout API call failed:', error);
      }
    }
    
    // Clear local state regardless of API result
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setLocation('/');
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const needsPasswordChange = user?.passwordNeedsReset === true;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user && !!token,
        needsPasswordChange,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
