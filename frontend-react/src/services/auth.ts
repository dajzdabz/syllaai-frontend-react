import { api } from './api';

/**
 * Service Layer for Authentication
 * 
 * This service is the single source of truth for all authentication state.
 * Responsibilities:
 * - Manages Google OAuth integration
 * - Handles API communication with backend
 * - Manages localStorage for tokens and user data
 * - Emits 'auth-change' events to notify React components
 * 
 * Data Flow: UI → authService → localStorage/API → 'auth-change' event → React Context
 */

interface GoogleAuthResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    name: string;
    picture?: string;
    is_professor: boolean;
    school_id?: number;
    created_at: string;
    updated_at: string;
  };
}

class AuthService {
  private googleAuth: any = null;

  async initializeGoogleAuth() {
    return new Promise<void>((resolve, reject) => {
      if (this.googleAuth) {
        resolve();
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 
                      'GOOGLE_CLIENT_ID_REMOVED';
      
      // Debug logging
      console.log('🔧 Google Auth Debug:', {
        clientId,
        env: import.meta.env,
        mode: import.meta.env.MODE,
        dev: import.meta.env.DEV,
        prod: import.meta.env.PROD
      });

      if (!clientId) {
        console.error('❌ Google Client ID is missing from environment variables');
        reject(new Error('Google Client ID not configured'));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: this.handleCredentialResponse.bind(this),
          });
          this.googleAuth = true;
          console.log('✅ Google Auth initialized successfully');
          resolve();
        } catch (error) {
          console.error('❌ Failed to initialize Google Auth:', error);
          reject(error);
        }
      };
      script.onerror = () => {
        console.error('❌ Failed to load Google GSI script');
        reject(new Error('Failed to load Google GSI script'));
      };
      document.head.appendChild(script);
    });
  }

  private async handleCredentialResponse(response: any) {
    try {
      console.log('🔧 Handling Google credential response:', response);
      
      const result = await api.post<GoogleAuthResponse>('/api/auth/authenticate', {
        id_token: response.credential,
      });

      console.log('✅ Authentication successful:', result.data);

      localStorage.setItem('access_token', result.data.access_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
      
      // Trigger a custom event to notify the app about login
      window.dispatchEvent(new CustomEvent('auth-change'));
      
      return result.data;
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  async signInWithGoogle(): Promise<void> {
    await this.initializeGoogleAuth();
    
    return new Promise((resolve, reject) => {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to popup if prompt fails
            this.showGoogleSignInPopup().then(resolve).catch(reject);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async showGoogleSignInPopup(): Promise<void> {
    await this.initializeGoogleAuth();
    
    return new Promise((resolve) => {
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        { 
          theme: 'outline', 
          size: 'large',
          width: 300,
        }
      );
      
      // The button will handle the sign-in flow
      resolve();
    });
  }

  signOut() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('auth-change'));
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getAccessToken() {
    return localStorage.getItem('access_token');
  }

  isAuthenticated() {
    return !!this.getAccessToken();
  }
}

export const authService = new AuthService();

// Global type declaration for Google Sign-In
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement | null, config: any) => void;
        };
      };
    };
  }
}