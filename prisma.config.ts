import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js uses .env.local, so load it for the Prisma CLI too
config({ path: ".env.local" });
config(); // fallback to .env

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});