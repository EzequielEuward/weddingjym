# Infraestructura y Deployment (Hosting Dual) — Wedding App

## 1. Arquitectura de Publicación Desacoplada por DNS

El código QR impreso en las mesas apunta **siempre** a un dominio propio gestionado en **Cloudflare DNS** (ej. `https://boda-apellido.com/entrar?evento=...`).

Gracias a esto, el servidor que responde detrás puede ser **tu PC con Arch Linux** o el **Plan B en la Nube (Contenedor + Supabase)** cambiando únicamente registros DNS en Cloudflare y variables `.env`, **sin tocar el código ni reimprimir un solo cartel**.

---

## 2. Contrato de Variables de Entorno (`.env`)

Validadas con `Zod` al arrancar el servidor (si falta una variable crítica, la app avisa claro y no arranca a medias):

```ini
NODE_ENV=production
PORT=3000

# Seguridad
COOKIE_SECRET=<cadena_aleatoria_min_32_chars>
QR_GATE_TOKEN=<token_unico_impreso_en_el_qr>
MODERATOR_PIN=<pin_secreto_moderador>

# Base de Datos (PostgreSQL local en Arch Linux o Pooler de Supabase)
DATABASE_URL=postgresql://user:pass@host:5432/wedding

# Almacenamiento de Imágenes: 'local' | 'supabase'
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/data/photos

# Solo requeridas si STORAGE_DRIVER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BUCKET=wedding-photos
```

---

## 3. Entorno A (Principal): Self-Hosted en tu Arch Linux

Hardware disponible: **Ryzen 5 3600G, 16 GB RAM, 480 GB SSD** (capacidad de sobra para miles de fotos y cientos de invitados simultáneos).

### 3.1 Componentes en `docker-compose.yml`
1. **`app`:** Contenedor único Same-Origin (`apps/web` estático + `apps/api` Express), política `restart: unless-stopped`, volumen montado `/mnt/wedding-data/photos:/data/photos`.
2. **`postgres`:** `postgres:16-alpine`, `restart: unless-stopped`, volumen persistente `/mnt/wedding-data/pgdata`.
3. **`cloudflared`:** Agente oficial de **Cloudflare Tunnel**, `restart: unless-stopped`. Conecta tu Arch Linux hacia Cloudflare por salida HTTPS segura **sin abrir puertos en el router de tu casa** y con certificado TLS automático.

### 3.2 Blindaje Operativo para el Día del Casamiento (Checklist Arch Linux)
Como vas a estar en la fiesta y no frente a la PC:
- [ ] **BIOS Auto-Boot:** Activar en la BIOS de la motherboard `Restore on AC/Power Loss = Power On` (si hay un microcorte de luz en tu cuadra, apenas vuelve la tensión la PC arranca sola).
- [ ] **Servicio Docker al arranque:** `sudo systemctl enable docker` para que al encender levante sola los 3 contenedores (`app`, `postgres`, `cloudflared`).
- [ ] **Suspensión desactivada:** Verificar que Arch Linux no entre en *sleep/suspend* por inactividad (`systemctl mask sleep.target suspend.target`).
- [ ] **Caché CDN en Cloudflare:** Como las fotos usan nombres inmutables (`<uuid>.webp`) y cabecera `Cache-Control: public, max-age=31536000, immutable`, Cloudflare cachea las fotos en su borde: cuando 100 invitados miran el muro, **Cloudflare las sirve desde su CDN sin saturar la subida de internet de tu casa**.
- [ ] **Backups locales automáticos:** Cron/timer cada 30 min durante el evento ejecutando `pg_dump` comprimido y copia espejo (`rsync`) de `/mnt/wedding-data/photos` a una segunda carpeta/disco.

---

## 4. Entorno B (Espejo / Fallback): Cloud Container + Supabase

Listo para probar antes de la fiesta o activar desde el celular en 2 minutos si el día del evento hubiera un corte prolongado de luz/ISP en tu barrio:
1. **Base y Fotos:** Proyecto gratuito en **Supabase** (recordar mantenerlo activo la semana del casamiento para evitar la pausa automática por 7 días de inactividad).
2. **Contenedor de la App:** El mismo `Dockerfile` desplegado en **Render / Koyeb / Railway** con `STORAGE_DRIVER=supabase` y el `DATABASE_URL` de Supabase.
3. **Cambio rápido (Cutover):** En el panel de Cloudflare DNS, cambiar el registro `CNAME` del dominio del túnel de Arch Linux al endpoint del contenedor cloud (con TTL Auto / Proxied en Cloudflare el cambio impacta en segundos).

---

## 5. Generación del Código QR Definitivo

- El QR **solo se genera para imprenta** cuando el dominio definitivo ya está activo en Cloudflare y probado en ambos entornos con el `QR_GATE_TOKEN` final.
- Usar nivel de corrección de errores **medio (`M` o `Q`)** y URL corta (`https://<dominio>/e?k=<token>`) para que los cuadrados del QR sean grandes y cualquier cámara los lea en medio segundo incluso en papel texturado.
