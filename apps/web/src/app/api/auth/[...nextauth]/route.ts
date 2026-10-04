import { handlers } from '@/auth';

/** Auth.js endpoints: sign-in, the Janua callback (`/api/auth/callback/janua`), session, CSRF. */
export const { GET, POST } = handlers;
