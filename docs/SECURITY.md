# Seguridad y Privacidad — Wedding App

## 1. Modelo de Amenazas Realista

Aunque es una aplicación sencilla para un casamiento familiar, el dominio será accesible públicamente por HTTPS para permitir el uso desde redes móviles 4G/5G. Las amenazas reales a cubrir son:
1. **Bots y curiosos externos** que descubren el dominio en logs públicos de certificados TLS e intentan ver fotos privadas o subir basura.
2. **Abuso o bromas en votaciones** intentando emitir múltiples votos para ganar *Best Outfit*.
3. **Subida de archivos maliciosos o corruptos** disfrazados de imágenes (`.exe`, `.html`/XSS, bombas de descompresión).
4. **Fuga de metadatos privados** (coordenadas GPS exactas del domicilio o teléfono en cabeceras EXIF).
5. **Falsos positivos por WiFi compartido (NAT)** si se bloquea ingenuamente por dirección IP en el salón.

---

## 2. Arquitectura de Acceso en Dos Capas (QR Único + Pulsera Individual)

### Capa 1 — Código de Acceso QR (`QR_GATE_TOKEN`)
- **Un único QR impreso para todo el salón** apunta a `https://<dominio>/entrar?evento=<QR_GATE_TOKEN>` (secreto aleatorio de alta entropía, mín. 24 caracteres).
- Al recibir ese token válido (comparación en tiempo constante `crypto.timingSafeEqual`), el servidor emite una cookie `HttpOnly` firmada (`wedding_gate=ok`, `SameSite=Lax`, `Secure` en prod, duración 30 días) y redirige a `/` limpiando el token de la barra de direcciones.
- **Todo endpoint `/api/*` y ruta de galería/subida** exige esa cookie válida; sin ella, rechaza con `401` y muestra la pantalla cerrada *"Escaneá el QR en el salón para ingresar"*.

### Capa 2 — Sesión de Invitado por Dispositivo (`guest_session_id`)
- Al atravesar el QR por primera vez, el servidor crea una fila en `guest_sessions` y guarda el `guest_session_id` en una cookie `HttpOnly` firmada con `COOKIE_SECRET` (`HMAC-SHA256`).
- Ningún cliente puede inventar ni modificar su `guest_session_id` desde JavaScript, protegiendo tanto la autoría al borrar fotos propias como la restricción `1 voto por foto por sesión`.

### Capa 3 — Acceso de Moderador (`MODERATOR_PIN`)
- Sin cuentas de administrador expuestas ni paneles complejos: ingresar el `MODERATOR_PIN` (mínimo 6–8 dígitos/caracteres configurado en `.env`) en la vista discreta de moderación valida contra el servidor con rate-limit estricto (**máx. 5 intentos cada 15 minutos por IP** para impedir fuerza bruta) y emite una cookie `HttpOnly` firmada `wedding_mod=true`.
- Solo esta cookie habilita eliminar fotos de terceros y cambiar el `Modo del Evento` (`live` | `read_only` | `closed`).

---

## 3. Seguridad en Subida y Procesamiento de Imágenes

Nunca se confía únicamente en la extensión del archivo ni en lo que reporta el navegador:
1. **Límites estrictos en `multer`:**
   - Tamaño máximo por imagen individual recibida en servidor: **`5 MB`** (como el cliente comprime a ~400 KB, 5 MB da margen holgado si fallara algún navegador viejo sin permitir abusos de disco).
   - Máximo de archivos por request en *Muro General*: **`10 fotos`**. En *Competencias*: **`1 foto`**.
2. **Validación por Magic Bytes y Recodificación (`sharp`):**
   - Se aceptan únicamente flujos reales de imagen (`image/jpeg`, `image/png`, `image/webp`, `image/heic`/`avif`).
   - `sharp` decodifica los píxeles reales, limita dimensiones máximas (`limitInputPixels` contra *image bombs*), **elimina todos los metadatos EXIF/GPS sensibles** (respetando la orientación de la foto con `.rotate()`) y escribe un nuevo `.webp` limpio. Cualquier payload ejecutable o XSS inyectado en metadatos queda destruido.
3. **Nombres de archivo seguros:** Se ignora por completo el `originalname` del teléfono; toda imagen se guarda bajo un `UUID` generado por el servidor (`full/<uuid>.webp`).

---

## 4. Rate Limiting Compatible con WiFi de Salón (NAT-Safe)

En un salón de eventos, decenas de invitados conectados al WiFi comparten **una misma IP pública**.
- **Prohibido bloquear 1 voto o 1 sesión por IP.**
- Los límites por IP se calibran solo contra ráfagas automatizadas (*burst abuse*):
  - Lectura de galería: holgado (+300 req/min por IP) + caché estático en imágenes.
  - Subida de fotos: máx. **20 fotos cada 5 minutos por `guest_session_id`** y tope global alto por IP (**150 subidas / 5 min**) para frenar scripts sin molestar a mesas enteras subiendo fotos a la vez.
  - Login de PIN de Moderador: **5 intentos / 15 min por IP** (único punto estricto por IP).

---

## 5. Privacidad, Eliminación y Retención Post-Evento

- **Cero datos personales sensibles (Zero-PII):** No se recolectan emails, teléfonos, documentos ni geolocalización; solo un Apodo libre.
- **Indexación bloqueada:** Cabecera `X-Robots-Tag: noindex, nofollow` y `robots.txt` cerrados para buscadores.
- **Derecho a borrado inmediato:**
  - El **Invitado** puede eliminar en cualquier momento las fotos vinculadas a su `guest_session_id`.
  - El **Moderador** puede eliminar cualquier foto al instante.
- **Ciclo post-casamiento:**
  1. Día posterior al evento: cambio a `read_only` (nadie más sube ni altera rankings; los invitados pueden ver y descargar recuerdos durante la ventana acordada, ej. 7 a 15 días).
  2. Cierre definitivo: respaldo completo en disco local de los novios / Arch Linux, paso a `closed` y apagado del túnel/contenedor público (y limpieza del bucket Supabase si se utilizó el Plan B).
