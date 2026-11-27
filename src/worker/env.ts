export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
  AI: Ai;
  ASSETS: Fetcher;
  /** Secret (wrangler secret put BETTER_AUTH_SECRET). Required outside localhost. */
  BETTER_AUTH_SECRET?: string;
  /** Secret: Google Routes API key (server-side only). */
  GOOGLE_MAPS_SERVER_KEY?: string;
  /** Var: Google Maps JavaScript API key, referrer-restricted, safe to expose to the browser. */
  GOOGLE_MAPS_BROWSER_KEY?: string;
  /** Secret: GL Account service key (server-side only, never logged or returned). */
  GL_ACCOUNT_KEY?: string;
  /** Var: GL Account origin. */
  GL_ACCOUNT_ORIGIN?: string;
  /** Var: this service's fixed public origin, used to build GL return URLs. */
  SERVICE_ORIGIN?: string;
  /** Test seam: override the Routes API endpoint (local dev only). */
  GOOGLE_ROUTES_ENDPOINT?: string;
}
