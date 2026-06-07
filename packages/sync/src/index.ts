import type { Board, BoardUpdateResult, SyncEvent, TeamRole } from '@voxa/core';

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

  async saveBoard(board: Board, expectedVersion?: number): Promise<BoardUpdateResult> {
    const res = await fetch(this.url(`/v1/boards/${board.id as string}`), {
      method: 'PUT',
      headers: teamHeaders(this.options),
      body: JSON.stringify({ ...board, expectedVersion }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Save failed: ${res.status}`);
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

  connectBoardSync(
    boardId: string,
    onEvent: (event: SyncEvent) => void,
    onStatus?: (status: 'connected' | 'disconnected') => void,
  ): () => void {
    const wsBase = this.options.baseUrl.replace(/^http/, 'ws');
    this.ws = new WebSocket(`${wsBase}/v1/ws?boardId=${encodeURIComponent(boardId)}`);

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
