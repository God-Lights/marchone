import type { Env } from "./env";
import type { Auth } from "./auth";

export interface SessionUser {
  id: string;
  name: string;
  isAnonymous?: boolean | null;
  homeCurrency?: string | null;
}

export interface AppEnv {
  Bindings: Env;
  Variables: { auth: Auth; user: SessionUser };
}
