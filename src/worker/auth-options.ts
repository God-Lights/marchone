import type { BetterAuthOptions } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { anonymous } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";

export interface AuthRuntime {
  origin: string;
  hostname: string;
  secret: string;
  /** Called when a guest's data must follow them into a signed-in account. */
  onLinkAccount?: (anonymousUserId: string, newUserId: string) => Promise<void>;
}

/** Shared Better Auth options (also used by scripts/auth-schema.mjs to generate SQL). */
export function authOptions(rt?: AuthRuntime): BetterAuthOptions {
  return {
    basePath: "/api/auth",
    baseURL: rt?.origin,
    secret: rt?.secret,
    trustedOrigins: rt ? [rt.origin] : [],
    user: {
      additionalFields: {
        homeCurrency: { type: "string", required: false, defaultValue: "KRW", input: true },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 365, // 1 year: a healing game should not log people out
      updateAge: 60 * 60 * 24 * 7,
    },
    hooks: {
      // A guest who registers a passkey becomes a real (non-anonymous) account,
      // so signing in elsewhere later links into it instead of being treated as a guest.
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/passkey/verify-registration") return;
        const user = ctx.context.session?.user as { id: string; isAnonymous?: boolean } | undefined;
        if (user?.isAnonymous) await ctx.context.internalAdapter.updateUser(user.id, { isAnonymous: false });
      }),
    },
    plugins: [
      anonymous({
        emailDomainName: "guest.marchone.local",
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await rt?.onLinkAccount?.(anonymousUser.user.id, newUser.user.id);
        },
      }),
      passkey({
        rpID: rt?.hostname ?? "localhost",
        rpName: "MarchOne",
        origin: rt?.origin ?? "http://localhost:5173",
      }),
    ],
  };
}
