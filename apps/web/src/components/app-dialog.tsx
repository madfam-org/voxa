'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { brand, neutral, surface } from '@/lib/tokens';

/**
 * In-app replacement for window.prompt / alert / confirm: a native modal
 * <dialog> (focus is trapped and Escape cancels), labelled by its message and
 * translated through the `dialog` catalogue namespace.
 */

type DialogRequest =
  | { kind: 'alert'; message: string; resolve: () => void }
  | { kind: 'confirm'; message: string; confirmLabel?: string; resolve: (ok: boolean) => void }
  | {
      kind: 'prompt';
      message: string;
      defaultValue: string;
      secret: boolean;
      resolve: (value: string | null) => void;
    };

export interface PromptOptions {
  defaultValue?: string;
  /** Mask the input (PIN entry). */
  secret?: boolean;
}

export interface AppDialogApi {
  /** Rendered dialog; place it once in the component tree. */
  dialog: React.ReactNode;
  alert: (message: string) => Promise<void>;
  confirm: (message: string, options?: { confirmLabel?: string }) => Promise<boolean>;
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
}

export function useAppDialog(): AppDialogApi {
  const [request, setRequest] = useState<DialogRequest | null>(null);

  const alert = useCallback(
    (message: string) =>
      new Promise<void>((resolve) => setRequest({ kind: 'alert', message, resolve })),
    [],
  );
  const confirm = useCallback(
    (message: string, options: { confirmLabel?: string } = {}) =>
      new Promise<boolean>((resolve) =>
        setRequest({ kind: 'confirm', message, confirmLabel: options.confirmLabel, resolve }),
      ),
    [],
  );
  const prompt = useCallback(
    (message: string, options: PromptOptions = {}) =>
      new Promise<string | null>((resolve) =>
        setRequest({
          kind: 'prompt',
          message,
          defaultValue: options.defaultValue ?? '',
          secret: options.secret ?? false,
          resolve,
        }),
      ),
    [],
  );

  const dialog = request ? (
    <AppDialog
      key={`${request.kind}:${request.message}`}
      request={request}
      onDone={() => setRequest(null)}
    />
  ) : null;

  return { dialog, alert, confirm, prompt };
}

function AppDialog({ request, onDone }: { request: DialogRequest; onDone: () => void }) {
  const t = useTranslations('dialog');
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);
  const messageId = useId();
  const [value, setValue] = useState(request.kind === 'prompt' ? request.defaultValue : '');

  useEffect(() => {
    const node = ref.current;
    if (node && !node.open && typeof node.showModal === 'function') node.showModal();
    if (request.kind === 'prompt') inputRef.current?.select();
  }, [request.kind]);

  const settle = (accepted: boolean) => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (request.kind === 'alert') request.resolve();
    else if (request.kind === 'confirm') request.resolve(accepted);
    else request.resolve(accepted ? value : null);
    ref.current?.close();
    onDone();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        settle(false);
      }}
      style={{
        maxWidth: 420,
        width: 'calc(100% - 32px)',
        background: surface.raised,
        color: neutral.text,
        border: `1px solid ${neutral.border}`,
        borderRadius: 12,
        padding: 20,
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          settle(true);
        }}
      >
        <p id={messageId} style={{ margin: '0 0 12px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {request.message}
        </p>
        {request.kind === 'prompt' ? (
          <input
            ref={inputRef}
            aria-labelledby={messageId}
            type={request.secret ? 'password' : 'text'}
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: surface.base,
              color: neutral.textSubtle,
              border: `1px solid ${neutral.border}`,
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 12,
            }}
          />
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {request.kind !== 'alert' ? (
            <button type="button" onClick={() => settle(false)} style={secondaryButton}>
              {t('cancel')}
            </button>
          ) : null}
          <button type="submit" style={primaryButton} autoFocus={request.kind !== 'prompt'}>
            {request.kind === 'confirm' && request.confirmLabel ? request.confirmLabel : t('ok')}
          </button>
        </div>
      </form>
    </dialog>
  );
}

const primaryButton: React.CSSProperties = {
  background: brand.primary,
  color: surface.white,
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  minHeight: 38,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: surface.overlay,
  border: `1px solid ${neutral.border}`,
};
