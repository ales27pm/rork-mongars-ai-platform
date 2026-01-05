export interface LocalProfile {
  userId: string;
  email?: string;
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
  };
  identityToken?: string;
  authorizationCode?: string;
  authenticatedAt: number;
}

export interface AppleCredentialState {
  state: 'authorized' | 'revoked' | 'not_found' | 'transferred' | 'unknown';
  userId: string;
}

export interface AuthState {
  ready: boolean;
  signedIn: boolean;
  profile: LocalProfile | null;
  isLoading: boolean;
  error: string | null;
}
