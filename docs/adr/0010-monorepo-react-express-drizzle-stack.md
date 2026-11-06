# Lean Monorepo Stack: React (Vite), Express, PostgreSQL, and Drizzle ORM

The project uses a minimal `pnpm workspaces` monorepo with three packages:
- `apps/web`: React + Vite + Tailwind CSS + React Router (Mobile-First SPA).
- `apps/api`: Node.js + Express + TypeScript + Drizzle ORM over PostgreSQL.
- `packages/shared`: Shared Zod schemas and TypeScript contracts.

In production, `apps/api` serves both `/api/*` endpoints and the compiled static assets of `apps/web` from a single container and origin. Choosing a dedicated Node server over serverless Next.js/Vercel avoids serverless 4.5 MB payload limits during multi-photo batch uploads and eliminates cross-domain `HttpOnly` cookie blocking on iOS Safari. Choosing Drizzle ORM over Prisma avoids native Rust/C++ binary engine issues in Docker, removes build-time `prisma generate` drift across monorepo packages, and enables single-query SQL aggregations for live vote counts.
