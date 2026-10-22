import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
const requiresDatabase = process.argv.includes("migrate");
if (requiresDatabase && !databaseUrl) {
  throw new Error("DATABASE_URL is missing. Add your Neon connection string to apps/web/.env.local.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl ?? "",
  },
});
