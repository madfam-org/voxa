import type { Board, BoardUpdateResult, StarterTemplateId, SyncEvent, TeamRole } from '@voxa/core';
import { VoxaSyncError } from './errors.js';
import { buildBoardSyncWsUrl } from './ws-url.js';

export { VoxaSyncError, isVersionConflictError } from './errors.js';
export { buildBoardSyncWsUrl } from './ws-url.js';

export interface VoxaClientOptions {
  baseUrl: string;
  userId?: string;
  role?: TeamRole;
  accessToken?: string;
}

export interface ObfImportResult extends BoardUpdateResult {
  warnings: string[];
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

  headers['X-Voxa-User-Id'] = options.userId ?? 'dev-user';
  headers['X-Voxa-Role'] = options.role ?? 'editor';
  return headers;
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => ({}))) as { error?: string };
  throw new VoxaSyncError(err.error ?? `${fallback}: ${res.status}`, res.status);
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

  async createBoard(board: Board, templateId?: StarterTemplateId): Promise<BoardUpdateResult> {
    const res = await fetch(this.url('/v1/boards'), {
      method: 'POST',
      headers: teamHeaders(this.options),
      body: JSON.stringify(templateId ? { ...board, templateId } : board),
    });
    if (!res.ok) {
      await throwApiError(res, 'Create failed');
    }
    return res.json() as Promise<BoardUpdateResult>;
  }

  async saveBoard(board: Board, expectedVersion?: number): Promise<BoardUpdateResult> {
    const res = await fetch(this.url(`/v1/boards/${board.id as string}`), {
      method: 'PUT',
      headers: teamHeaders(this.options),
      body: JSON.stringify({ ...board, expectedVersion }),
    });
    if (!res.ok) {
      await throwApiError(res, 'Save failed');
    }
    return res.json() as Promise<BoardUpdateResult>;
  }

  async importObf(boardId: string, obfJson: string): Promise<ObfImportResult> {
    const headers = { ...teamHeaders(this.options), 'Content-Type': 'text/plain' };
    const res = await fetch(this.url(`/v1/boards/${boardId}/import/obf`), {
      method: 'POST',
      headers,
      body: obfJson,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Import failed: ${res.status}`);
    }
    return res.json() as Promise<ObfImportResult>;
  }

  async exportObf(boardId: string): Promise<string> {
    const res = await fetch(this.url(`/v1/boards/${boardId}/export/obf`), {
      headers: teamHeaders(this.options),
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return res.text();
  }

  async importObz(boardId: string, archive: ArrayBuffer): Promise<ObfImportResult> {
    const headers = { ...teamHeaders(this.options), 'Content-Type': 'application/zip' };
    const res = await fetch(this.url(`/v1/boards/${boardId}/import/obz`), {
      method: 'POST',
      headers,
      body: archive,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Import failed: ${res.status}`);
    }
    return res.json() as Promise<ObfImportResult>;
  }

  async importGridset(boardId: string, archive: ArrayBuffer): Promise<ObfImportResult> {
    const headers = { ...teamHeaders(this.options), 'Content-Type': 'application/octet-stream' };
    const res = await fetch(this.url(`/v1/boards/${boardId}/import/gridset`), {
      method: 'POST',
      headers,
      body: archive,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Import failed: ${res.status}`);
    }
    return res.json() as Promise<ObfImportResult>;
  }

  async importSnap(boardId: string, archive: ArrayBuffer): Promise<ObfImportResult> {
    const headers = { ...teamHeaders(this.options), 'Content-Type': 'application/octet-stream' };
    const res = await fetch(this.url(`/v1/boards/${boardId}/import/snap`), {
      method: 'POST',
      headers,
      body: archive,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Import failed: ${res.status}`);
    }
    return res.json() as Promise<ObfImportResult>;
  }

  async importTouchChat(boardId: string, archive: ArrayBuffer): Promise<ObfImportResult> {
    const headers = { ...teamHeaders(this.options), 'Content-Type': 'application/octet-stream' };
    const res = await fetch(this.url(`/v1/boards/${boardId}/import/touchchat`), {
      method: 'POST',
      headers,
      body: archive,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Import failed: ${res.status}`);
    }
    return res.json() as Promise<ObfImportResult>;
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

  connectBoardSync(
    boardId: string,
    onEvent: (event: SyncEvent) => void,
    onStatus?: (status: 'connected' | 'disconnected') => void,
  ): () => void {
    this.ws = new WebSocket(
      buildBoardSyncWsUrl(this.options.baseUrl, boardId, this.options.accessToken),
    );

    this.ws.onopen = () => onStatus?.('connected');
    this.ws.onclose = () => onStatus?.('disconnected');
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data as string) as SyncMessage;
      if (data.type === 'sync') onEvent(data.event);
    };

    return () => {
      this.ws?.close();
      this.ws = null;
    };
  }
}

export function createVoxaClient(options: VoxaClientOptions): VoxaClient {
  return new VoxaClient(options);
}
