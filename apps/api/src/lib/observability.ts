export function initObservability(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  void import('@sentry/node')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? 'development',
        release: process.env.VOXA_VERSION ?? '1.0.0',
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      });
    })
    .catch((err) => {
      console.warn('Sentry init skipped:', (err as Error).message);
    });
}

export function captureException(error: unknown): void {
  if (!process.env.SENTRY_DSN) return;
  void import('@sentry/node')
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => undefined);
}
