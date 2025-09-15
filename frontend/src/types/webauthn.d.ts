// WebOTP API types
interface OTPCredentialRequestOptions {
  transport: string[];
}

interface OTPCredential extends Credential {
  code: string;
}

interface CredentialRequestOptions {
  otp?: OTPCredentialRequestOptions;
  signal?: AbortSignal;
}

interface NavigatorCredentials {
  get(options?: CredentialRequestOptions): Promise<Credential | OTPCredential | null>;
}

interface Navigator {
  credentials: NavigatorCredentials;
}

declare global {
  interface Window {
    OTPCredential: typeof OTPCredential;
  }
}

export {};