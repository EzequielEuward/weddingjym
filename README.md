# Wedding App 📸🥂

Aplicación web **100% Mobile-First** para el casamiento (evento diurno, *Single-Event*). Permite a los invitados escanear un único código QR en el salón para compartir fotografías en vivo en el **Muro General** y participar votando en **Best Outfit**, sin instalar aplicaciones ni crear cuentas.

---

## Arquitectura en 30 Segundos

- **Monorepo liviano (`pnpm workspaces`):**
  - `apps/web` — React + Vite + React Router + Tailwind CSS (estética clara cálida de alto contraste para pleno día).
  - `apps/api` — Node.js + Express + TypeScript + Drizzle ORM sobre PostgreSQL.
  - `packages/shared` — Esquemas `Zod` y contratos compartidos.
- **Same-Origin:** En producción, `apps/api` sirve tanto `/api/*` como el build estático de `apps/web` desde un mismo contenedor, garantizando compatibilidad total de cookies `HttpOnly` en iOS Safari y Android Chrome.
- **Hosting Dual detrás de Cloudflare DNS:** Corre localmente en **Arch Linux** (`Docker Compose` + Postgres local + SSD local + `Cloudflare Tunnel`) y es 100% portable por `.env` a contenedor Cloud + **Supabase** cambiando `DATABASE_URL` y `STORAGE_DRIVER=local|supabase`.

---

## Mapa de Documentación (Fuente de Verdad)

| Documento | Propósito |
| :--- | :--- |
| [`GLOSSARY.md`](./GLOSSARY.md) | Lenguaje ubicuo y definiciones exactas del dominio. |
| [`AGENTS.md`](./AGENTS.md) | Reglas permanentes e índice de contexto para agentes de programación. |
| [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md) | Alcance funcional (MVP vs. diferidos), flujos de usuario y decisiones pre-evento pendientes. |
| [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) | Sistema visual diurno Mobile-First, paleta cálida, tipografía, componentes y estados. |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Topología del monorepo, justificación del stack, módulos profundos y *seams*. |
| [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) | Esquema PostgreSQL / Drizzle ORM (`event_settings`, `guest_sessions`, `photos`, `votes`). |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | Llave QR de salón, sesiones por dispositivo, PIN de moderador, validación de imágenes y NAT WiFi. |
| [`docs/TESTING.md`](./docs/TESTING.md) | Estrategia de tests de integración y checklist en celulares reales. |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Operación en Arch Linux (Docker, BIOS auto-boot, Cloudflare Tunnel, backups) y Plan B Supabase. |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Etapas incrementales de implementación. |
| [`docs/adr/`](./docs/adr/) | Registro atómico de las 10 decisiones arquitectónicas (ADRs `0001`–`0010`). |

---

## Estado Actual

**Fases 1, 2, 3 y 4 completadas.** El MVP completo (*Muro General*, competencia *Best Outfit* con votos ❤️, sesiones QR y *Moderación con PIN*) está operativo y cubierto por tests de integración. Próxima etapa: **Fase 5 (Hosting Dual Docker/Arch Linux + Supabase + QR definitivo)**.
