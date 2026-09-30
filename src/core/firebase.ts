import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod';
import { ApiError } from './errors.js';

const firebaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FIREBASE_PROJECT_ID: z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
  FIREBASE_ALLOW_AUTH_EMULATOR: z.enum(['true', 'false']).default('false'),
});

export function firebaseRuntimeConfig(input: unknown) {
  const values = firebaseEnvSchema.parse(input);
  if (values.NODE_ENV === 'production' &&
      (values.FIREBASE_AUTH_EMULATOR_HOST || values.FIREBASE_ALLOW_AUTH_EMULATOR === 'true')) {
    throw new Error('Firebase Auth emulator is forbidden in production');
  }
  if (values.FIREBASE_AUTH_EMULATOR_HOST) {
    if (values.FIREBASE_ALLOW_AUTH_EMULATOR !== 'true' || !values.FIREBASE_PROJECT_ID.startsWith('demo-')) {
      throw new Error('Firebase Auth emulator requires explicit opt-in and a demo- project');
    }
    if (!/^(localhost|127\.0\.0\.1|\[::1\]):[0-9]{1,5}$/.test(values.FIREBASE_AUTH_EMULATOR_HOST)) {
      throw new Error('Firebase Auth emulator must use a loopback host and port');
    }
    const port = Number(values.FIREBASE_AUTH_EMULATOR_HOST.split(':').at(-1));
    if (port < 1 || port > 65535) throw new Error('Firebase Auth emulator port is invalid');
  } else if (values.FIREBASE_ALLOW_AUTH_EMULATOR === 'true') {
    throw new Error('Firebase Auth emulator opt-in requires an emulator host');
  }
  if (values.NODE_ENV === 'production' && values.FIREBASE_PROJECT_ID.startsWith('demo-')) {
    throw new Error('Production requires a real Firebase project');
  }
  return values;
}

export interface VerifiedFirebaseIdentity {
  projectId: string;
  uid: string;
  email: string;
  authTime: number;
  expiresAt: number;
  signInProvider: string;
  secondFactor: 'totp' | 'phone' | null;
}

type FirebaseAuthGateway = Pick<Auth, 'verifyIdToken' | 'verifySessionCookie' | 'createSessionCookie' | 'revokeRefreshTokens'>;

export class FirebaseIdentityVerifier {
  constructor(
    private readonly auth: FirebaseAuthGateway,
    private readonly projectId: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async verifyIdToken(token: string): Promise<VerifiedFirebaseIdentity> {
    this.validateToken(token);
    let decoded: DecodedIdToken;
    try {
      decoded = await this.auth.verifyIdToken(token, true);
    } catch {
      throw ApiError.unauthorized('Firebase identity could not be verified', 'INVALID_FIREBASE_IDENTITY');
    }
    return this.identity(decoded, `https://securetoken.google.com/${this.projectId}`);
  }

  async verifySessionCookie(cookie: string): Promise<VerifiedFirebaseIdentity> {
    this.validateToken(cookie);
    let decoded: DecodedIdToken;
    try {
      decoded = await this.auth.verifySessionCookie(cookie, true);
    } catch {
      throw ApiError.unauthorized('Firebase session could not be verified', 'INVALID_FIREBASE_IDENTITY');
    }
    return this.identity(decoded, `https://session.firebase.google.com/${this.projectId}`);
  }

  async createSessionCookie(token: string): Promise<string> {
    const identity = await this.verifyIdToken(token);
    if (Math.floor(this.now() / 1000) - identity.authTime > 300) {
      throw ApiError.unauthorized('Recent Firebase sign-in required', 'RECENT_AUTH_REQUIRED');
    }
    try {
      return await this.auth.createSessionCookie(token, { expiresIn: 5 * 24 * 60 * 60 * 1000 });
    } catch {
      throw ApiError.unauthorized('Firebase session could not be created', 'INVALID_FIREBASE_IDENTITY');
    }
  }

  async revokeAllSessions(uid: string): Promise<void> {
    if (!uid || uid.length > 128) throw ApiError.badRequest('Invalid Firebase UID');
    try {
      await this.auth.revokeRefreshTokens(uid);
    } catch {
      throw ApiError.internal('Firebase revocation requires retry', 'FIREBASE_REVOCATION_FAILED');
    }
  }

  private validateToken(token: string) {
    if (typeof token !== 'string' || token.length < 1 || token.length > 16384 || /\s/.test(token)) {
      throw ApiError.unauthorized('Invalid Firebase credential', 'INVALID_FIREBASE_IDENTITY');
    }
  }

  private identity(decoded: DecodedIdToken, issuer: string): VerifiedFirebaseIdentity {
    const now = Math.floor(this.now() / 1000);
    if (decoded.iss !== issuer || decoded.aud !== this.projectId ||
        typeof decoded.sub !== 'string' || !decoded.sub || decoded.sub.length > 128 || decoded.uid !== decoded.sub ||
        !Number.isInteger(decoded.exp) || decoded.exp <= now ||
        !Number.isInteger(decoded.iat) || decoded.iat > now || decoded.iat >= decoded.exp ||
        !Number.isInteger(decoded.auth_time) || decoded.auth_time < 0 || decoded.auth_time > decoded.iat ||
        decoded.firebase?.tenant !== undefined ||
        typeof decoded.firebase?.sign_in_provider !== 'string' || !decoded.firebase.sign_in_provider ||
        decoded.firebase.sign_in_provider === 'custom') {
      throw ApiError.unauthorized('Firebase identity claims are invalid', 'INVALID_FIREBASE_IDENTITY');
    }
    if (decoded.email_verified !== true || typeof decoded.email !== 'string' ||
        !z.string().email().max(320).safeParse(decoded.email).success) {
      throw ApiError.forbidden('Verify your email before onboarding', 'EMAIL_VERIFICATION_REQUIRED');
    }
    const factor = decoded.firebase.sign_in_second_factor;
    // Provider linkage and arbitrary custom claims never become application grants.
    return {
      projectId: this.projectId,
      uid: decoded.uid,
      email: decoded.email,
      authTime: decoded.auth_time,
      expiresAt: decoded.exp,
      signInProvider: decoded.firebase.sign_in_provider,
      secondFactor: factor === 'totp' || factor === 'phone' ? factor : null,
    };
  }
}

let verifier: FirebaseIdentityVerifier | undefined;
let configuredEnvironment: string | undefined;

export function getFirebaseIdentityVerifier(): FirebaseIdentityVerifier {
  const options = firebaseRuntimeConfig(process.env);
  const environment = JSON.stringify(options);
  if (configuredEnvironment !== undefined && configuredEnvironment !== environment) {
    throw new Error('Firebase environment changed; restart the process');
  }
  if (!verifier) {
    const app = initializeApp({
      projectId: options.FIREBASE_PROJECT_ID,
      ...(options.FIREBASE_AUTH_EMULATOR_HOST ? {} : { credential: applicationDefault() }),
    }, 'volunteerops-identity');
    verifier = new FirebaseIdentityVerifier(getAuth(app), options.FIREBASE_PROJECT_ID);
    configuredEnvironment = environment;
  }
  return verifier;
}