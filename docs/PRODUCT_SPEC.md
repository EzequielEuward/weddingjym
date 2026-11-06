# Especificación de Producto — Wedding App (Joa & Maga)

## 1. Visión y Contexto Real del Evento

- **Evento:** Casamiento de **Joa & Maga** (*Civil + Brunch*).
- **Fecha y Horario:** **Sábado 7 de noviembre de 2026**, de **9:45 hs a 15:00 hs aprox.** (evento diurno).
- **Lugar:** **Aldeano** — Laguna Azul, La Calera, Córdoba *(contexto semi-rural/sierras donde optimizar el peso de subida para señal 4G variable es crítico)*.
- **Dress Code del evento:** *Elegante sport* (*"Lindos, cómodos y bien ustedes"*) — calza ideal con la dinámica de **Best Outfit**.
- ** Tono de Voz:** Español rioplatense cercano y cálido (*"vos"*: *"Subí tus fotos"*, *"Elegí tus looks favoritos"*, *"Escaneá el QR de tu mesa"*), en total continuidad visual y estética con `https://casamientojoaymaga.netlify.app/`.

---

## 2. Actores del Dominio

*(Ver definiciones canónicas en [`GLOSSARY.md`](../GLOSSARY.md)).*

1. **Invitado (`Guest`)**: Ingresa escaneando el único QR impreso del salón; mira todo libremente desde el primer segundo y recién al subir una foto o votar completa su **Apodo** una única vez (*Lazy Onboarding*).
2. **Moderador (`Moderator`)**: Rol único liviano (Ezequiel) que desbloquea controles in-situ mediante un **PIN secreto** para eliminar cualquier foto o cambiar el **Modo del Evento** (`live` / `read_only` / `closed`). Sin back-office separado ni exportación `.zip` desde el celular (el resguardo masivo de archivos se gestiona desde la computadora/servidor).

---

## 3. Alcance Funcional (MVP Enfocado al 07.11.2026 vs. Diferidos)

Cada módulo del Home soporta estado configurable (`active` | `coming_soon` | `hidden`):

| Módulo | Ruta | Estado inicial | Reglas Clave |
| :--- | :--- | :--- | :--- |
| **Home (Hub / Bento)** | `/` | `active` | Encabezado `Joa & Maga`, preview compacto de 4 fotos recientes del Muro + tarjetas de módulos. |
| **Muro General** | `/galeria` | `active` (MVP) | Álbum vivo compartido. Subida múltiple (*batch* hasta 10 fotos por tanda), polling liviano cada 20s, descarga individual y borrado de fotos propias. |
| **Competencia: Best Outfit** | `/best-outfit` | `active` (MVP) | Concurso de looks. Hasta **3 postulaciones por celular** (permite subir el look propio y ayudar a subir el de un familiar mayor), 1 foto + epígrafe corto opcional (`<= 80 chars`), votación con ❤️ (auto-voto permitido, máx. 1 ❤️ por foto por sesión), tabs *Recientes* y *Top Ranking*. |
| **Presentación en Pantalla** | `/presentacion` | `active` (MVP) | Modo pantalla completa automático (cada **6 seg**) accesible desde galerías y `/moderador`. Muestra cada foto 100% entera sin recortar (`object-contain`), horizontal o vertical, sobre fondo difuminado de la misma foto, con selector *Todas / Álbum General / Best Outfit* y actualización viva. |
| **Competencia: Best Bloopers** | `/best-bloopers` | `coming_soon` / `hidden` | Reutiliza el mismo motor de *Competencia* que *Best Outfit*. Se enciende solo si se desea antes del sábado. |
| **Bingo Musical** | `/bingo` | `coming_soon` / `hidden` | Placeholder *"Próximamente"* (u oculto el sábado si no se llega a cargar). Fuera del camino crítico. |

---

## 4. Flujos Principales y Reglas de Negocio

### 4.1 Acceso por QR Único y *Lazy Onboarding*
1. **Un único cartel QR para todo el salón** apunta a `https://<dominio>/entrar?evento=<QR_GATE_TOKEN>`.
2. Al escanearlo, el servidor valida la llave del salón, crea automáticamente la cookie `HttpOnly` firmada con el `guest_session_id` individual del teléfono y redirige a `/` **sin mostrar ningún formulario bloqueante**.
3. Quien entre al dominio pelado desde internet sin haber escaneado el QR ve únicamente la portada cerrada: *"Acceso exclusivo para invitados de Joa & Maga — Escaneá el código QR en el salón"*.
4. **Pedido de Apodo diferido (*Lazy*):** Recién la primera vez que el invitado toca *"Subir fotos"*, *"Subir mi Outfit"* o toca un ❤️ para votar, se despliega una tarjeta inferior pidiendo *"¿Cómo te llamás?"* (`2..30` caracteres). Una vez guardado, no vuelve a pedirse.

### 4.2 Actualización Suave del Muro (Polling de 20s sin saltos)
- Mientras un invitado tiene abierta `/galeria` o `/best-outfit` con la pantalla activa (`document.visibilityState === 'visible'`), la app consulta livianamente cada **20 segundos** si hay fotos más recientes que la primera visible.
- Si hay nuevas fotos, muestra arriba una pildorita flotante: **«✨ Hay fotos nuevas — Tocá para ver»** (o actualiza al hacer pull/tap), evitando usar WebSockets costosos en batería y evitando que la grilla salte sola mientras alguien mira una foto.

### 4.3 Subida Optimizada para Señal de Sierras (La Calera)
- En el navegador del celular se comprime y convierte cada imagen (`.heic` de iPhone incluido) a ~1920px máx. (~300–500 KB) antes de transmitirla.
- En **Muro General (`/galeria`)**: selección de hasta 10 fotos juntas, sin epígrafe.
- En **Best Outfit (`/best-outfit`)**: subida de a 1 foto con epígrafe corto opcional (ej. *"El look de la Abu Rosa"*), con un **límite de hasta 3 postulaciones activas por `guest_session_id`** (si borra una propia que salió movida, recupera ese cupo).
- Si falla la red móvil a mitad del envío, las imágenes ya comprimidas se mantienen listas en pantalla con un botón grande **"Reintentar subida"**.

### 4.4 Votación en *Best Outfit*
- Voto tipo corazón ❤️ reversible (`toggle`), máximo **1 voto por foto por `guest_session_id`**.
- Se permite que un invitado vote su propia postulación (vale 1 voto igual para todos).
- Vista por defecto: **Recientes** (para no perjudicar a quienes llegan más cerca del mediodía); segunda pestaña: **Top Ranking** ordenado por cantidad de votos.

### 4.5 Descarga, Borrado y Moderación In-Situ
- **Descarga individual:** Cualquier invitado puede descargar a su teléfono cualquier foto individual desde la vista ampliada (*Lightbox*). No existe descarga `.zip` en la interfaz móvil; la copia completa de todas las fotos del evento se obtiene directamente en la PC/servidor después del festejo.
- **Borrado propio:** Cada invitado ve la opción *"Eliminar mi foto"* únicamente sobre las fotos subidas desde su propia `guest_session_id`.
- **Moderación con PIN:** Ingresando el `MODERATOR_PIN` en `/moderador`, Ezequiel habilita en su propio teléfono el botón de eliminar sobre cualquier foto de terceros y el selector de estado del evento (`live` → `read_only` al terminar el brunch el sábado por la tarde → `closed`).

### 4.6 Presentación en Pantalla Completa (`/presentacion`)
- **Acceso dual:** Disponible tanto para invitados (botón *"Presentación"* dentro de `/galeria` y `/best-outfit`) como desde `/moderador` para proyectar cómodo en una TV, monitor o notebook durante o después del evento.
- **Foto 100% entera sin recortar:** Tanto fotos horizontales como verticales se renderizan completas (`object-contain`) en resolución `fullUrl`, rellenando los laterales libres con un fondo difuminado suave de la misma imagen (*marco digital*).
- **Reproducción automática viva:** Avanza sola cada **6 segundos**, permite filtrar al vuelo entre *Todas*, *Álbum General* y *Best Outfit*, soporta pantalla completa nativa (`Fullscreen API` + teclado `Espacio` / flechas), oculta controles tras inactividad e incorpora automáticamente las fotos nuevas que se vayan subiendo.

---

## 5. Parámetros Centralizados (`wedding.config`)

Todos los textos e identidad del evento vivirán en una configuración central tipada:
- Novios: `Joa & Maga`
- Fecha: `07 · 11 · 2026` (`7 de noviembre de 2026`)
- Lugar: `Aldeano · Laguna Azul, La Calera`
- Módulos activos: `general: 'active'`, `best_outfit: 'active'`, `best_bloopers: 'coming_soon'`, `bingo: 'coming_soon'`
- Único dato operativo pendiente para producción: **Dominio definitivo en Cloudflare DNS** (para imprimir el QR a tiempo antes del sábado 7/11).
