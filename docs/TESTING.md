# Estrategia de Testing — Wedding App

## 1. Filosofía Pragmática

Testeamos **comportamientos críticos e invariantes a través de las interfaces públicas de cada módulo**, nunca detalles internos de implementación ni snapshots frágiles de UI. El objetivo es llegar al día del casamiento con total confianza de que las subidas, los votos, los permisos y el QR no van a fallar en plena fiesta.

---

## 2. Pirámide de Pruebas del Monorepo

### Nivel 1 — Contratos y Reglas Puras (`packages/shared` + utilidades) — `Vitest`
Rápidos (`< 1s`), sin red ni base de datos:
- Esquemas `Zod`: validación de apodos (longitud, caracteres vacíos), límites de epígrafes en *Best Outfit* (`<= 80 chars`), modos del evento (`live | read_only | closed`).

### Nivel 2 — Tests de Integración de API y Dominio (`apps/api`) — `Vitest` + `Supertest`
**El corazón de nuestra seguridad técnica.** Ejercitan los endpoints HTTP reales contra una base PostgreSQL de test y el adaptador `InMemoryPhotoStorage`:
1. **Puerta QR y Sesiones (`SECURITY`):**
   - Request sin cookie de evento es rechazado con `401`.
   - Escaneo con `?evento=<token_valido>` emite cookies `HttpOnly` firmadas; token inválido rebota.
   - Dos escaneos desde clientes distintos con el mismo QR generan dos `guest_session_id` independientes.
2. **Pipeline de Subida (`ImageIngestPipeline`):**
   - Imagen válida genera registro en DB + versión `full` y `thumb` en `PhotoStorage`, sin metadatos EXIF GPS.
   - Archivo falso (ej. texto/script renombrado a `.jpg`) es rechazado con `400` sin ensuciar storage ni DB.
   - Cuando el evento está en modo `read_only`, las subidas devuelven `403`.
3. **Votaciones y Cupo en Competencias (*Best Outfit*):**
   - Un invitado puede subir hasta **3 postulaciones activas** en *Best Outfit* (4ª subida rechazada con mensaje claro; si elimina una propia, recupera el cupo).
   - Un invitado puede dar ❤️ a múltiples fotos distintas (incluida la propia), pero votar dos veces la misma foto hace toggle/no duplica votos (respaldado por `UNIQUE(photo_id, guest_session_id)`).
   - El conteo `vote_count` y el flag `voted_by_me` reflejan con exactitud la sesión consultante.
4. **Permisos de Borrado y PIN Moderador:**
   - Invitado A puede borrar su propia foto; Invitado B intentando borrar la foto de A recibe `403`.
   - Moderador con PIN válido puede borrar cualquier foto y cambiar el modo a `read_only`; tras 5 PINs erróneos actúa el rate-limit (`429`).

### Nivel 3 — Smoke & Ensayo Real en Celulares (Pre-Casamiento)
Ningún emulador reemplaza probar en teléfonos reales antes de imprimir los QR:
- [ ] Escanear el QR físico impreso en papel con **iPhone (cámara nativa → Safari)** y **Android (cámara → Chrome)**.
- [ ] Subir una foto `.HEIC` real sacada con iPhone y verificar conversión y visualización en Android.
- [ ] Subir un lote de 6 fotos seguidas con el celular en **datos móviles 4G** (WiFi apagado) simulando señal de salón.
- [ ] Probar el botón físico/gesto **"Atrás"** navegando `Home → Best Outfit → Home → Muro General`.
- [ ] Probar recarga de página verificando que el celular conserva su sesión, su apodo y sus corazones votados.
