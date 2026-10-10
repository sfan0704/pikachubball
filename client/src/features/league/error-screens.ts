import { ApiError, type ApiErrorCode } from "@/api/errors";

/** What a screen offers the user after an error. */
export type ErrorAction = "retry" | "sign-in" | "reconnect-yahoo" | "pick-league" | "none";

/** What to tell the user about a failed request, decided in one place for every code. */
export interface ErrorScreenContent {
  readonly code: ApiErrorCode | "UNKNOWN";
  readonly title: string;
  readonly message: string;
  readonly action: ErrorAction;
  /** Quote this when asking for help; null when the failure never reached the server. */
  readonly requestId: string | null;
}

const SCREENS: Record<ApiErrorCode, Omit<ErrorScreenContent, "code" | "requestId">> = {
  UNAUTHORIZED: {
    title: "Please sign in",
    message: "Your session has ended.",
    action: "sign-in",
  },
  YAHOO_RECONNECT_REQUIRED: {
    title: "Sign in with Yahoo again",
    message: "Yahoo no longer lets this app read your leagues. Signing in again restores access.",
    action: "reconnect-yahoo",
  },
  FORBIDDEN: {
    title: "That league isn't available",
    message: "It isn't one of your leagues. Choose one of yours instead.",
    action: "pick-league",
  },
  NOT_FOUND: {
    title: "Not found",
    message: "What you asked for doesn't exist.",
    action: "pick-league",
  },
  CONFLICT: {
    title: "That changed while you were working",
    message: "Reload and try again.",
    action: "retry",
  },
  VALIDATION_ERROR: {
    title: "Something went wrong",
    message: "The request wasn't accepted. Try again, or choose a different league or week.",
    action: "retry",
  },
  RATE_LIMITED: {
    title: "Too many refreshes",
    message: "Too many refreshes. Try again in a minute.",
    action: "retry",
  },
  YAHOO_RATE_LIMITED: {
    title: "Too many refreshes",
    message: "Yahoo is limiting requests. Try again in a minute.",
    action: "retry",
  },
  YAHOO_UNAVAILABLE: {
    title: "Yahoo isn't responding",
    message: "Yahoo Fantasy isn't responding right now.",
    action: "retry",
  },
  INTERNAL_ERROR: {
    title: "Something went wrong",
    message: "An unexpected error occurred.",
    action: "retry",
  },
  NETWORK_ERROR: {
    title: "Can't reach the server",
    message: "Check your connection and try again.",
    action: "retry",
  },
  INVALID_RESPONSE: {
    title: "Something went wrong",
    message: "The server sent something the app couldn't read.",
    action: "retry",
  },
};

/** The screen for any error: an ApiError by its code, anything else as a generic failure. */
export function describeError(error: unknown): ErrorScreenContent {
  if (error instanceof ApiError) {
    return { code: error.code, ...SCREENS[error.code], requestId: error.requestId };
  }
  return { code: "UNKNOWN", ...SCREENS.INTERNAL_ERROR, requestId: null };
}
