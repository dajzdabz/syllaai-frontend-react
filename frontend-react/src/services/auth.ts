import { apiService } from './api';
import type { User, AuthResponse } from '../types';

/**
 * Production-Ready Authentication Service
 * 
 * This service handles all authentication flows including:
 * - Google OAuth with both ID token and authorization code flows
 * - Calendar permission management
 * - Token storage and refresh
 * - User state management
 * - Event-driven updates to React components
 * 
 * Data Flow: UI → authService → API → localStorage → 'auth-change' event → React Context
 */

// Google OAuth configuration
interface GoogleOAuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
}

// OAuth flow types

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleAuthCodeResponse {
  code: string;
  scope?: string;
  authuser?: string;
  prompt?: string;
}

class AuthService {
  private googleAuth: any = null;
  private googleOAuth2: any = null;
  private config: GoogleOAuthConfig;
  private isInitialized = false;
  private selectedRole: 'professor' | 'student' | null = null;

  constructor() {
    this.config = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      redirectUri: import.meta.env.VITE_REDIRECT_URI || 
                   `${window.location.origin}/auth/callback`,
      scope: 'openid email profile https://www.googleapis.com/auth/calendar'
    };
  }

  async initializeGoogleAuth(requestCalendarAccess = false): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      if (!this.config.clientId) {
        console.error('❌ Google Client ID is missing from environment variables');
        reject(new Error('Google Client ID not configured'));
        return;
      }

      console.log('🔧 Initializing Google Auth:', {
        clientId: this.config.clientId,
        requestCalendarAccess,
        scope: this.config.scope
      });

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        // Add a small delay to ensure Google's script is fully loaded
        setTimeout(() => {
          try {
            if (!window.google || !window.google.accounts) {
              throw new Error('Google accounts API not available');
            }

            // Initialize GSI for ID token flow (simple sign-in)
            window.google.accounts.id.initialize({
              client_id: this.config.clientId,
              callback: this.handleCredentialResponse.bind(this),
              auto_select: false,
              cancel_on_tap_outside: false
            });

            // Initialize OAuth2 for authorization code flow (calendar access)
            this.googleOAuth2 = window.google.accounts.oauth2.initCodeClient({
              client_id: this.config.clientId,
              scope: this.config.scope,
              ux_mode: 'popup',
              callback: this.handleAuthCodeResponse.bind(this)
            });

            this.googleAuth = true;
            this.isInitialized = true;
            console.log('✅ Google Auth initialized successfully');
            resolve();
          } catch (error) {
            console.error('❌ Failed to initialize Google Auth:', error);
            reject(error);
          }
        }, 100);
      };
      script.onerror = () => {
        console.error('❌ Failed to load Google GSI script');
        reject(new Error('Failed to load Google GSI script'));
      };
      
      // Don't add script if it's already present
      if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        document.head.appendChild(script);
      } else {
        // Script already loaded, just initialize with delay
        setTimeout(() => {
          try {
            if (!window.google || !window.google.accounts) {
              throw new Error('Google accounts API not available');
            }

            // Initialize GSI for ID token flow (simple sign-in)
            window.google.accounts.id.initialize({
              client_id: this.config.clientId,
              callback: this.handleCredentialResponse.bind(this),
              auto_select: false,
              cancel_on_tap_outside: false
            });

            // Initialize OAuth2 for authorization code flow (calendar access)
            this.googleOAuth2 = window.google.accounts.oauth2.initCodeClient({
              client_id: this.config.clientId,
              scope: this.config.scope,
              ux_mode: 'popup',
              callback: this.handleAuthCodeResponse.bind(this)
            });

            this.googleAuth = true;
            this.isInitialized = true;
            console.log('✅ Google Auth initialized successfully');
            resolve();
          } catch (error) {
            console.error('❌ Failed to initialize Google Auth:', error);
            reject(error);
          }
        }, 100);
      }
    });
  }

  private async handleCredentialResponse(response: GoogleCredentialResponse): Promise<void> {
    try {
      console.log('🔧 Handling Google credential response (ID token flow)');
      
      const result = await apiService.authenticate({
        id_token: response.credential,
        role: this.selectedRole || undefined,
      });

      console.log('✅ ID token authentication successful');
      this.storeAuthData(result);
      
    } catch (error) {
      console.error('❌ ID token authentication failed:', error);
      throw error;
    }
  }

  private async handleAuthCodeResponse(response: GoogleAuthCodeResponse): Promise<void> {
    try {
      console.log('🔧 Handling Google auth code response (calendar access)');
      
      const result = await apiService.authenticate({
        authorization_code: response.code,
        redirect_uri: this.config.redirectUri,
        role: this.selectedRole || undefined,
      });

      console.log('✅ Auth code authentication successful (with calendar access)');
      this.storeAuthData(result);
      
    } catch (error) {
      console.error('❌ Auth code authentication failed:', error);
      throw error;
    }
  }

  private storeAuthData(authResponse: AuthResponse): void {
    localStorage.setItem('access_token', authResponse.access_token);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    
    // Store additional auth metadata
    localStorage.setItem('auth_expires_at', 
      (Date.now() + (authResponse.expires_in * 1000)).toString()
    );
    
    if (authResponse.permissions) {
      localStorage.setItem('user_permissions', JSON.stringify(authResponse.permissions));
    }
    
    // Trigger auth change event
    window.dispatchEvent(new CustomEvent('auth-change', {
      detail: { user: authResponse.user, authenticated: true }
    }));
  }

  async signInWithGoogle(role?: 'professor' | 'student', requestCalendarAccess = false): Promise<void> {
    // Store the selected role for the authentication request
    this.selectedRole = role || null;
    
    await this.initializeGoogleAuth(requestCalendarAccess);
    
    if (requestCalendarAccess) {
      // Use OAuth2 flow for calendar access
      return this.signInWithCalendarAccess();
    } else {
      // Use simple ID token flow
      return this.signInSimple();
    }
  }

  private async signInSimple(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use direct popup instead of One Tap to avoid FedCM warnings
        this.showGoogleSignInPopup().then(resolve).catch(reject);
      } catch (error) {
        console.error('❌ Simple sign-in failed:', error);
        reject(error);
      }
    });
  }

  private async signInWithCalendarAccess(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Request authorization code for calendar access
        this.googleOAuth2.requestCode();
        resolve();
      } catch (error) {
        console.error('❌ Calendar access sign-in failed:', error);
        reject(error);
      }
    });
  }

  private async showGoogleSignInPopup(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create a temporary container for the button
        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'fixed';
        buttonContainer.style.top = '-9999px';
        buttonContainer.id = 'temp-google-signin-button';
        document.body.appendChild(buttonContainer);
        
        window.google.accounts.id.renderButton(buttonContainer, {
          theme: 'outline',
          size: 'large',
          width: 300,
          click_listener: () => {
            document.body.removeChild(buttonContainer);
            resolve();
          }
        });
        
        // Auto-click the button to trigger sign-in
        setTimeout(() => {
          const button = buttonContainer.querySelector('div[role="button"]') as HTMLElement;
          if (button) {
            button.click();
          }
        }, 100);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  async requestCalendarPermission(): Promise<void> {
    await this.initializeGoogleAuth(true);
    return this.signInWithCalendarAccess();
  }

  hasCalendarPermission(): boolean {
    const user = this.getCurrentUser();
    return user?.has_calendar_access || false;
  }

  signOut(): void {
    // Clear all auth-related data
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_expires_at');
    localStorage.removeItem('user_permissions');
    
    // Sign out from Google
    if (this.googleAuth && window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    
    // Trigger auth change event
    window.dispatchEvent(new CustomEvent('auth-change', {
      detail: { user: null, authenticated: false }
    }));
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('❌ Failed to parse user data:', error);
      return null;
    }
  }

  getAccessToken(): string | null {
    const token = localStorage.getItem('access_token');
    const expiresAt = localStorage.getItem('auth_expires_at');
    
    // Check if token is expired
    if (expiresAt && Date.now() > parseInt(expiresAt)) {
      console.log('🔄 Access token expired, clearing auth data');
      this.signOut();
      return null;
    }
    
    return token;
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  getUserPermissions(): string[] {
    const permissions = localStorage.getItem('user_permissions');
    if (!permissions) return [];
    
    try {
      return JSON.parse(permissions);
    } catch (error) {
      console.error('❌ Failed to parse user permissions:', error);
      return [];
    }
  }

  async refreshUserData(): Promise<User | null> {
    try {
      if (!this.isAuthenticated()) {
        return null;
      }
      
      const user = await apiService.getCurrentUser();
      localStorage.setItem('user', JSON.stringify(user));
      
      window.dispatchEvent(new CustomEvent('auth-change', {
        detail: { user, authenticated: true }
      }));
      
      return user;
    } catch (error) {
      console.error('❌ Failed to refresh user data:', error);
      // If refresh fails due to auth error, sign out
      if ((error as any)?.type === 'AUTHENTICATION_ERROR') {
        this.signOut();
      }
      return null;
    }
  }

  // Health check method
  async checkAuthStatus(): Promise<boolean> {
    try {
      if (!this.isAuthenticated()) {
        return false;
      }
      
      await apiService.getCurrentUser();
      return true;
    } catch (error) {
      console.error('❌ Auth status check failed:', error);
      this.signOut();
      return false;
    }
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
          disableAutoSelect: () => void;
        };
        oauth2: {
          initCodeClient: (config: any) => any;
        };
      };
    };
  }
}