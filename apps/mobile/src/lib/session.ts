export interface MobileSession {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email?: string;
  name?: string;
  expiresAt: number;
}
