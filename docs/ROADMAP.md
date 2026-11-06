# Roadmap de Desarrollo — Wedding App

El orden de construcción está diseñado para llegar **con margen de prueba real antes del sábado `07.11.2026`** (Civil + Brunch de Joa & Maga en Aldeano, La Calera), asegurando primero el circuito principal completo y sumando las capas interactivas sin retrabajo.

---

## Fase 1 — Discovery & Project Harness *(Completada)*
- [x] Entrevista *Grill Me* de producto, UX, seguridad e infraestructura.
- [x] Definición del lenguaje ubicuo en [`GLOSSARY.md`](../GLOSSARY.md) y 10 ADRs en [`docs/adr/`](./adr/).
- [x] Especificación funcional, Design System diurno, modelo de datos, seguridad y estrategia de Hosting Dual.
- [x] **Hito de salida:** Aprobación humana de toda la documentación base antes de iniciar código.

---

## Fase 2 — Foundation (Esqueleto del Monorepo y Design System Base) *(Completada)*
- [x] Inicialización de `pnpm workspaces` (`apps/web`, `apps/api`, `packages/shared`) con TypeScript estricto y scripts unificados.
- [x] Configuración de PostgreSQL + **Drizzle ORM** con las 4 tablas e índices iniciales + entorno de test (`Vitest` + `PGlite` PostgreSQL embebido).
- [x] Implementación del seam `PhotoStorage` (`LocalDiskPhotoStorage` + `InMemoryPhotoStorage`; `SupabasePhotoStorage` en Fase 5).
- [x] Tokens CSS y componentes base del [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) de *Joa & Maga* en Tailwind (`apps/web`).
- [x] **Criterio de completitud:** `pnpm build`, `pnpm typecheck` y `pnpm test` pasan en verde; `/api/health` responde `200` contra Postgres.

---

## Fase 3 — Core Application (QR + Home Bento + Muro General) *(Completada)*
- [x] Puerta de acceso por QR (`/entrar?evento=...`), cookies `HttpOnly` firmadas (`wedding_gate` y `guest_session_id`) y pantalla de bloqueo para accesos externos sin QR.
- [x] Onboarding liviano de **Apodo** en el primer uso interactivo.
- [x] Pantalla **Home (Hub / Bento)** con preview vivo 2x2 y navegación por rutas reales.
- [x] Pipeline completo de subida de fotos: compresión cliente (`.webp`/`.jpg` + conversión `.heic` de iOS) + validación `sharp` en servidor + limpieza EXIF + thumbnail `400px`.
- [x] **Muro General (`/galeria`)**: subida en lote, grilla viva con polling cada 20s, *Lightbox*, descarga y **borrado de fotos propias**.
- [x] **Criterio de completitud:** Producto 100% funcional; tests de integración de acceso, subida y borrado propio en verde.

---

## Fase 4 — Competencia *Best Outfit* y Moderación con PIN *(Completada)*
- [x] Ruta `/best-outfit` con subida contextual individual (1 foto con preview `4:5` + epígrafe corto opcional y límite de 3 postulaciones por celular).
- [x] Motor de **Votación con Corazones ❤️** (`1 voto máx. por foto por sesión`, actualización optimista en UI, vista *Recientes* por defecto y pestaña *Top Ranking*).
- [x] Modo **Moderador in-situ con PIN** (`/moderador`): borrado de cualquier foto y cambio de **Modo del Evento** (`live` / `read_only` / `closed`) + rate-limiting anti fuerza bruta.
- [x] Configuración por estado (`active | coming_soon | hidden`) para las tarjetas opcionales.
- [x] **Criterio de completitud:** Tests de integración de unicidad de votos, permisos de moderador y bloqueo en `read_only` en verde.

---

## Fase 5 — Hosting Dual, Ensayo en Celulares Reales y Puesta en Producción *(Código listo — Listo para despliegue en Arch Linux)*
- [x] Modo **Presentación en Pantalla (`/presentacion`)** para TV / notebook / celular sin recortar fotos verticales ni horizontales.
- [x] Adaptador `SupabasePhotoStorage` para completar la paridad con el Plan B Cloud.
- [x] `Dockerfile` multi-stage Same-Origin + `docker-compose.yml` para **Arch Linux** (con `postgres` y `cloudflared` + script `scripts/backup-local.sh`).
- [ ] Prueba cruzada real: despliegue en tu **Arch Linux** detrás de **Cloudflare DNS** y ensayo en celulares iPhone y Android sobre red 4G.
- [ ] Generación y verificación en papel del **código QR definitivo**.

---

## Fase 6 — Módulos Opcionales Post-MVP *(Solo si sobra tiempo cómodo)*
1. **Activar *Best Bloopers*:** Habilitar la 3ª tarjeta reutilizando el mismo módulo de *Competencia* ya probado en *Best Outfit* (costo casi cero).
2. **Implementar *Bingo Musical*:** Reemplazar el estado *"Próximamente"* por la generación de cartones aleatorios de canciones si deciden jugarlo en la fiesta.
