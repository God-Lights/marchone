// Prints the SQL Better Auth needs (core + plugins) for an empty SQLite/D1 database.
// Usage: node scripts/auth-schema.mjs > migrations/000X_auth.sql   (then review by hand)
import { DatabaseSync } from "node:sqlite";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../src/worker/auth-options.ts";

const { compileMigrations } = await getMigrations({ ...authOptions(), database: new DatabaseSync(":memory:") });
console.log(await compileMigrations());
