import * as Sentry from '@sentry/react-native';

// PASTE YOUR SENTRY DSN HERE once you've created a free project at
// https://sentry.io — Settings → Projects → (your project) → Client Keys (DSN).
// Leave as an empty string to disable reporting entirely (no-op, safe default).
const SENTRY_DSN ='https://7d20952171629e8c119ad43264cf54e1@o4512000863633408.ingest.de.sentry.io/4512000873005136';

export function initErrorReporting() {
  if (!SENTRY_DSN) return; // no-op until a real DSN is set
  Sentry.init({
    dsn: SENTRY_DSN,
    // Sends a small sample of performance traces, not just crashes — cheap
    // and well within Sentry's free tier at this app's scale.
    tracesSampleRate: 0.2,
    // Expo Go can't fully symbolicate native crashes (that needs a real
    // build), but JS-level errors and unhandled rejections still report
    // correctly even in Expo Go — useful for catching bugs during testing.
    enableNative: true,
  });
}

/** Manually report a caught error with extra context, e.g. from a catch
 * block where we already show the user a friendly message but still want
 * visibility into what actually went wrong. */
export function reportError(error: unknown, context?: Record<string, any>) {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
