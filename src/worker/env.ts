export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
  AI: Ai;
  ASSETS: Fetcher;
  /** Secret (wrangler secret put BETTER_AUTH_SECRET). Required outside localhost. */
  BETTER_AUTH_SECRET?: string;
  GOOGLE_MAPS_SERVER_KEY?: string;
}
