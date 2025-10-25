export interface ErrorResponse {
  error: {
    type?: number; // 401 in this case
    message?: string; // 'Unauthenticated'
    detail?: string; // 'Must enter a one time code to log in'
    code?: string; // 'ERR_MUST_USE_OTC_USER_OPTED_IN'
    fallbackMessage?: string; // "ClassDojo wants to keep your account safe. We've sent a one-time login code to your@account.tld."
    expected?: boolean; // true
  };
}