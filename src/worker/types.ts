import type { Env } from "./env";
import type { Auth } from "./auth";

export interface SessionUser {
  id: string;
  name: string;
  isAnonymous?: boolean | null;
  homeCurrency?: string | null;
  /** Present when signed in through GL Account. */
  gl?: { id: string; nickname: string; username: string } | null;
}

export interface AppEnv {
  Bindings: Env;
  Variables: { auth: Auth; user: SessionUser };
}
