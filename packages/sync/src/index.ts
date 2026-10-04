import type { Board, BoardUpdateResult, StarterTemplateId, SyncEvent, TeamRole } from '@voxa/core';
import { VoxaSyncError } from './errors.js';
import { buildBoardSyncWsUrl } from './ws-url.js';

export { VoxaSyncError, isVersionConflictError } from './errors.js';
export { buildBoardSyncWsUrl } from './ws-url.js';

export interface VoxaClientOptions {
  /**
   * Base of the HTTP API. Native clients use the API origin; the web app uses
   * its same-origin proxy (`/api`), which adds the bearer on the server.
   */
  baseUrl: string;
  /** Origin for the WebSocket (the API origin). Defaults to `baseUrl`. */
  wsBaseUrl?: string;
  userId?: string;
  role?: TeamRole;
  /** Bearer for clients that call the API directly (mobile). The web app never holds one. */
  accessToken?: string;
  /**
   * The web app's session cookie authenticates every call through the
   * same-origin proxy: send no Authorization and no development headers.
   */
  sameOriginSession?: boolean;
  /** Called once when the WebSocket gives up because the caller is not signed in. */
  onUnauthorized?: () => void;
}

/** File formats `importBoards` accepts. Grid 3, Snap and TouchChat are beta (one page, words only). */
export type BoardImportFormat = 'obf' | 'obz' | 'gridset' | 'snap' | 'touchchat';

/** Answer of `POST /v1/boards/import/:format`: the NEW boards the file became. */
export interface BoardImportResult {
  boards: Board[];
  rootBoardId: string;
  warnings: string[];
  skipped: { images: number; sounds: number; links: number; buttons: number };
  beta: boolean;
}

export type SyncMessage =
  | { type: 'connected'; boardId: string; presence: number }
  | { type: 'sync'; event: SyncEvent };

function teamHeaders(options: VoxaClientOptions): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
    return headers;
  }
  if (options.sameOriginSession) return headers;

  headers['X-Voxa-User-Id'] = options.userId ?? 'dev-user';
  headers['X-Voxa-Role'] = options.role ?? 'editor';
  return headers;
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  throw new VoxaSyncError(err.error ?? `${fallback}: ${res.status}`, res.status, err);
}

export class VoxaClient {
  private ws: WebSocket | null = null;

  constructor(private readonly options: VoxaClientOptions) {}

  private url(path: string): string {
    return `${this.options.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async getBoard(boardId: string): Promise<Board> {
    const res = await fetch(this.url(`/v1/boards/${boardId}`), {
      headers: teamHeaders(this.options),
    });
    if (!res.ok) throw new Error(`Failed to load board: ${res.status}`);
    return res.json() as Promise<Board>;
  }

  async listBoards(): Promise<Board[]> {
    const res = await fetch(this.url('/v1/boards'), { headers: teamHeaders(this.options) });
    if (!res.ok) throw new Error(`Failed to list boards: ${res.status}`);
    const body = (await res.json()) as { boards: Board[] };
    return body.boards;
  }

  /**
   * Create a board. With `templateId` the server builds the starter template
   * in `contentLocale` (es-MX, en-US or fr-FR; the server defaults to es-MX).
   */
  async createBoard(
    board: Board,
    templateId?: StarterTemplateId,
    contentLocale?: string,
  ): Promise<BoardUpdateResult> {
    const res = await fetch(this.url('/v1/boards'), {
      method: 'POST',
      headers: teamHeaders(this.options),
      body: JSON.stringify(
        templateId ? { ...board, templateId, ...(contentLocale ? { contentLocale } : {}) } : board,
      ),
    });
    if (!res.ok) {
      await throwApiError(res, 'Create failed');
    }
    return res.json() as Promise<BoardUpdateResult>;
  }

  /**
   * Save a board. `forceMotorPlanning` asks the server to accept moves of
   * locked (motor-plan) buttons; send it only for an admin's explicit override.
   */
  async saveBoard(
    board: Board,
    expectedVersion?: number,
    options: { forceMotorPlanning?: boolean } = {},
  ): Promise<BoardUpdateResult> {
    const res = await fetch(this.url(`/v1/boards/${board.id as string}`), {
      method: 'PUT',
      headers: teamHeaders(this.options),
      body: JSON.stringify({
        ...board,
        expectedVersion,
        ...(options.forceMotorPlanning ? { forceMotorPlanning: true } : {}),
      }),
    });
    if (!res.ok) {
      await throwApiError(res, 'Save failed');
    }
    return res.json() as Promise<BoardUpdateResult>;
  }

  /**
   * Import a board file as NEW boards (never into an existing one). `locale`
   * (es-MX, en-US, fr-FR) is used for files that carry no locale.
   */
  async importBoards(
    format: BoardImportFormat,
    body: string | ArrayBuffer,
    options: { locale?: string } = {},
  ): Promise<BoardImportResult> {
    const query = options.locale ? `?locale=${encodeURIComponent(options.locale)}` : '';
    const contentType =
      format === 'obf' ? 'application/json' : format === 'obz' ? 'application/zip' : 'application/octet-stream';
    const res = await fetch(this.url(`/v1/boards/import/${format}${query}`), {
      method: 'POST',
      headers: { ...teamHeaders(this.options), 'Content-Type': contentType },
      body,
    });
    if (!res.ok) {
      await throwApiError(res, 'Import failed');
    }
    return res.json() as Promise<BoardImportResult>;
  }

  async exportObf(boardId: string): Promise<string> {
    const res = await fetch(this.url(`/v1/boards/${boardId}/export/obf`), {
      headers: teamHeaders(this.options),
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return res.text();
  }





  async listStarterTemplates(): Promise<Array<{ id: string; name: string; description: string }>> {
    const res = await fetch(this.url('/v1/boards/templates/list'), {
      headers: teamHeaders(this.options),
    });
    if (!res.ok) throw new Error(`Failed to load templates: ${res.status}`);
    const body = (await res.json()) as { templates: Array<{ id: string; name: string; description: string }> };
    return body.templates;
  }

  async exportObz(boardId: string): Promise<ArrayBuffer> {
    const res = await fetch(this.url(`/v1/boards/${boardId}/export/obz`), {
      headers: teamHeaders(this.options),
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return res.arrayBuffer();
  }

  async deleteBoard(boardId: string): Promise<void> {
    const res = await fetch(this.url(`/v1/boards/${boardId}`), {
      method: 'DELETE',
      headers: teamHeaders(this.options),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Delete failed: ${res.status}`);
    }
  }

  /**
   * Mints a single-use WebSocket ticket (valid 30 seconds) for the caller.
   * Throws a VoxaSyncError with the HTTP status when it is refused.
   */
  async createWsTicket(): Promise<string> {
    const res = await fetch(this.url('/v1/ws-ticket'), {
      method: 'POST',
      headers: teamHeaders(this.options),
    });
    if (!res.ok) {
      await throwApiError(res, 'WebSocket ticket refused');
    }
    const body = (await res.json()) as { ticket?: unknown };
    if (typeof body.ticket !== 'string') throw new VoxaSyncError('Malformed WebSocket ticket', 502);
    return body.ticket;
  }

  /**
   * Live sync for one board. Each connection opens with a fresh ticket. When
   * the socket closes (network loss, or the API closing it at the access
   * token's expiry) it reconnects with a new ticket, backing off up to 30
   * seconds; it stops when the caller is no longer signed in (401/403).
   */
  connectBoardSync(
    boardId: string,
    onEvent: (event: SyncEvent) => void,
    onStatus?: (status: 'connected' | 'disconnected') => void,
  ): () => void {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const wsBase = this.options.wsBaseUrl ?? this.options.baseUrl;

    const scheduleRetry = () => {
      if (disposed) return;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
      attempt += 1;
      retryTimer = setTimeout(() => void open(), delay);
    };

    const open = async () => {
      let ticket: string;
      try {
        ticket = await this.createWsTicket();
      } catch (err) {
        if (disposed) return;
        onStatus?.('disconnected');
        const status = err instanceof VoxaSyncError ? err.status : 0;
        if (status === 401 || status === 403) {
          this.options.onUnauthorized?.();
          return;
        }
        scheduleRetry();
        return;
      }
      if (disposed) return;

      const ws = new WebSocket(buildBoardSyncWsUrl(wsBase, boardId, ticket));
      this.ws = ws;
      ws.onopen = () => {
        attempt = 0;
        onStatus?.('connected');
      };
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        if (disposed) return;
        onStatus?.('disconnected');
        scheduleRetry();
      };
      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data as string) as SyncMessage;
        if (data.type === 'sync') onEvent(data.event);
      };
    };

    void open();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      this.ws?.close();
      this.ws = null;
    };
  }
}

export function createVoxaClient(options: VoxaClientOptions): VoxaClient {
  return new VoxaClient(options);
}
