# AGENTS.md — Reglas del Proyecto Wedding App

Aplicación web Mobile-First para un único casamiento diurno. Monorepo `pnpm` (`apps/web` React+Vite+Tailwind, `apps/api` Express+Drizzle+PostgreSQL, `packages/shared` Zod) empaquetado Same-Origin y portable por `.env` entre **Arch Linux Docker** (`STORAGE_DRIVER=local`) y **Cloud + Supabase** (`STORAGE_DRIVER=supabase`).

## Context Pointers (Leer antes de actuar según la tarea)

- **Terminología y nombres en código/UI:** Leer [`GLOSSARY.md`](./GLOSSARY.md) para usar el lenguaje canónico (*Invitado*, *Sesión de Invitado*, *Código de Acceso QR*, *Muro General*, *Competencia*, *Postulación*, *Voto*, *Modo del Evento*).
- **Flujos funcionales, alcance MVP (`Muro General` + `Best Outfit`) o módulos diferidos (`Bloopers`, `Bingo Musical`):** Leer [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md).
- **Pantallas React, estilos Tailwind, colores, tipografía, carga o estados de error:** Leer [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md).
- **Estructura de carpetas, dependencias, módulos profundos o adaptadores `PhotoStorage`:** Leer [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) y [`docs/adr/`](./docs/adr/).
- **Esquemas Drizzle, migraciones SQL, queries de galería o ranking de votos:** Leer [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md).
- **Cookies, QR gate, PIN de moderador, subida de archivos o rate-limiting:** Leer [`docs/SECURITY.md`](./docs/SECURITY.md).
- **Tests unitarios o de integración:** Leer [`docs/TESTING.md`](./docs/TESTING.md).
- **Docker, variables `.env`, Cloudflare Tunnel, Arch Linux o Supabase:** Leer [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).
- **Orden de implementación y criterios de salida por etapa:** Leer [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## Invariantes Arquitectónicos y de Producto

1. **Portabilidad Dual estricta:** Acceder a datos únicamente vía Drizzle (`DATABASE_URL`) y al almacenamiento de fotos únicamente vía el seam del servidor `PhotoStorage` (`local` | `supabase` | `memory`). Mantener `apps/web` libre de SDKs directos de infraestructura (como `@supabase/supabase-js`).
2. **Same-Origin y Cookies `HttpOnly`:** Emitir `wedding_gate`, `guest_session_id` y `wedding_mod` como cookies `HttpOnly` firmadas desde `apps/api` bajo el mismo origen que `apps/web` para garantizar compatibilidad con Safari en iOS.
3. **WiFi de salón compartido (NAT-Safe):** Identificar autoría y unicidad de votos (`UNIQUE(photo_id, guest_session_id)`) por `guest_session_id`. Aplicar rate-limits por IP solo con umbrales altos anti-bots (excepto login de `MODERATOR_PIN`: máx. 5 intentos / 15 min).
4. **Imágenes seguras y livianas:** Comprimir/convertir (incluyendo `.heic`) en el navegador antes de subir (~400 KB) y recodificar con `sharp` en servidor eliminando metadatos EXIF/GPS y generando thumbnail de `400px`.
5. **UX Diurna 100% Móvil:** Diseñar sobre paleta clara cálida de alto contraste (legible bajo sol directo), áreas táctiles `>= 48px`, `font-size >= 16px` en inputs (evita zoom en iOS) y rutas reales de URL (preserva el botón "Atrás" del teléfono).
6. **Módulos profundos sin capas vacías:** Crear abstracciones/seams únicamente donde existen múltiples adaptadores reales (`PhotoStorage`). Mantener validación y tipos compartidos en una única fuente dentro de `packages/shared`.

## Reglas de Trabajo del Agente

1. **Consultar antes de asumir:** Detenerse y preguntar al usuario antes de alterar decisiones de producto, agregar dependencias pesadas o modificar la arquitectura documentada en `docs/adr/`.
2. **Definición previa al código:** Implementar únicamente funcionalidades especificadas en `docs/PRODUCT_SPEC.md` y correspondientes a la fase activa de `docs/ROADMAP.md`.
3. **Verificación obligatoria:** Acompañar toda lógica crítica de negocio/seguridad (QR gate, subida, votos, borrado propio, PIN moderador, modo `read_only`) con tests de integración que pasen antes de dar la tarea por terminada.
4. **Sincronía documental:** Actualizar el documento correspondiente en `docs/` o `GLOSSARY.md` en el mismo cambio cuando se modifique el comportamiento o el modelo del sistema.
5. **Higiene de secretos:** Mantener credenciales, tokens QR, `COOKIE_SECRET` y PINs exclusivamente en variables de entorno ignoradas por Git, documentando únicamente plantillas vacías en `.env.example`.
