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
      console.log('📤 Sending authentication request with:', {
        hasIdToken: !!response.credential,
        idTokenLength: response.credential?.length,
        role: this.selectedRole
      });
      
      const result = await apiService.authenticate({
        credential: response.credential,
        role: this.selectedRole || undefined,
      }).catch(error => {
        console.error('🚨 AUTHENTICATION API CALL FAILED:', error);
        console.error('🚨 Full error object:', JSON.stringify(error, null, 2));
        throw error;
      });

      console.log('✅ ID token authentication successful');
      console.log('📥 Authentication response:', {
        authenticated: result.authenticated,
        sessionExpiresIn: result.session_expires_in,
        user: result.user,
        hasPermissions: !!result.permissions
      });
      
      this.storeAuthData(result);
      console.log('💾 Auth data stored in localStorage');
      
    } catch (error: any) {
      console.error('❌ ID token authentication failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        type: error.type,
        statusCode: error.statusCode,
        response: error.response?.data || error.details
      });
      
      // Show user-friendly error message
      const errorMessage = error.response?.data?.detail || error.message || 'Authentication failed';
      alert(`Authentication failed: ${errorMessage}`);
      
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
    // SECURITY FIX: No longer store access tokens in localStorage
    // Tokens are now secure HttpOnly cookies managed by the backend
    
    // Only store non-sensitive user data and permissions
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    
    if (authResponse.permissions) {
      localStorage.setItem('user_permissions', JSON.stringify(authResponse.permissions));
    }
    
    // Store session metadata (no sensitive tokens)
    localStorage.setItem('session_expires_at', 
      (Date.now() + (authResponse.session_expires_in * 1000)).toString()
    );
    
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

  async signOut(): Promise<void> {
    try {
      // Call backend logout to clear secure cookie
      await apiService.logout();
    } catch (error) {
      console.error('❌ Backend logout failed:', error);
      // Continue with frontend cleanup even if backend fails
    }
    
    // Clear non-sensitive data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('session_expires_at');
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
    // SECURITY FIX: Tokens are now in secure HttpOnly cookies
    // Frontend no longer has direct access to tokens
    // Return null to indicate cookies are being used
    return null;
  }

  isAuthenticated(): boolean {
    // Check session expiry from localStorage metadata
    const expiresAt = localStorage.getItem('session_expires_at');
    const user = localStorage.getItem('user');
    
    if (!user) return false;
    
    // Check if session is expired
    if (expiresAt && Date.now() > parseInt(expiresAt)) {
      console.log('🔄 Session expired, clearing auth data');
      this.signOut();
      return false;
    }
    
    return true;
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