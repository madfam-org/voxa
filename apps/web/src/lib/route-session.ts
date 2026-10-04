import { handlers } from '@/auth';
import { readServerSession, type ServerSession } from './server-session';

/** `readServerSession` wired to this app's Auth.js handlers (route handlers only). */
export function sessionForRequest(request: Request): Promise<ServerSession> {
  return readServerSession(request, { sessionHandler: handlers.GET });
}
