export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
  AI: Ai;
  ASSETS: Fetcher;
  // Secrets (wrangler secret put): GOOGLE_MAPS_SERVER_KEY, VAPID_PRIVATE_KEY, ...
  GOOGLE_MAPS_SERVER_KEY?: string;
}
