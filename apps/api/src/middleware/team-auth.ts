import type { Context, Next } from 'hono';
import type { TeamRole } from '@voxa/core';

export interface TeamContext {
  userId: string;
  role: TeamRole;
}

declare module 'hono' {
  interface ContextVariableMap {
    team: TeamContext;
  }
}

const VALID_ROLES: TeamRole[] = ['communicator', 'editor', 'admin'];

export function teamAuth() {
  return async (c: Context, next: Next) => {
    const userId = c.req.header('X-Voxa-User-Id') ?? 'dev-user';
    const roleHeader = c.req.header('X-Voxa-Role') ?? 'editor';
    const role = VALID_ROLES.includes(roleHeader as TeamRole)
      ? (roleHeader as TeamRole)
      : 'communicator';

    c.set('team', { userId, role });
    await next();
  };
}

export function requireEditor(c: Context): boolean {
  const { role } = c.get('team');
  return role === 'editor' || role === 'admin';
}
