import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { authService } from '../services/auth';

/**
 * React State Management Layer for Authentication
 * 
 * This context provides authentication state to React components.
 * Responsibilities:
 * - Subscribes to authService via 'auth-change' events
 * - Provides user state and loading state to component tree
 * - Delegates logout actions to authService
 * 
 * IMPORTANT: This context does NOT manage localStorage or API calls directly.
 * All authentication logic is handled by authService (single source of truth).
 * 
 * Data Flow: authService → 'auth-change' event → AuthContext → React components
 */

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize with current user from authService (sole source of truth)
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);

    // Listen for auth changes from the auth service
    const handleAuthChange = () => {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const logout = () => {
    authService.signOut();
    // User state will be updated via 'auth-change' event
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};