# Design System — Joa & Maga Wedding App (`07.11.2026`)

## 1. Identidad Visual (Heredada de la Invitación Oficial)

El sistema de diseño replica con fidelidad exacta la estética editorial cálida de la invitación web oficial de **Joa & Maga** (`https://casamientojoaymaga.netlify.app/`), adaptada a una experiencia interactiva **100% Mobile-First** para el civil + brunch diurno (9:45 a 15:00 hs en *Aldeano, Laguna Azul, La Calera*).

Tres pilares rigen toda pantalla:
1. **Continuidad total con la invitación:** Misma paleta papel/arena/tinta expreso, mismas tipografías (*Cormorant Garamond* + *Montserrat*), mismos bordes finos cálidos y botones *pill*. Al escanear el QR en las mesas, el invitado siente que está dentro del mismo universo visual.
2. **Legibilidad diurna al aire libre (Laguna Azul):** El contraste entre tinta oscura (`#2f2b27`) y papel cálido (`#fbf8f3` / `#f4efe7`) supera `12:1` (WCAG AAA), garantizando lectura perfecta bajo el sol del mediodía sin el reflejo espejado de un tema oscuro.
3. **Ergonomía de una mano (Thumb Zone):** Botones de `min-height: 48px`, `border-radius: 999px` y acciones clave en la mitad inferior de la pantalla.

---

## 2. Tokens Exactos de Color (`:root` / Tailwind `@theme`)

Extraídos directamente de la hoja de estilos de la invitación de **Joa & Maga**, sumando únicamente los dos semánticos interactivos necesarios para votos y errores:

```css
:root {
  /* Paleta Oficial Invitación Joa & Maga */
  --bg:      #f4efe7; /* Fondo general lienzo arena cálido (theme-color: #f5f1ea) */
  --paper:   #fbf8f3; /* Superficie de tarjetas Bento, modales y secciones */
  --ink:     #2f2b27; /* Texto primario + fondo de botones principales (.btn) */
  --muted:   #776f66; /* Textos secundarios, horas y etiquetas uppercase */
  --line:    #d9cfc2; /* Bordes 1px solid y divisores finos */
  --accent:  #7a6b5a; /* Taupe cálido para estados :focus, tabs activas y detalles */
  --white:   #ffffff; /* Fondo de inputs y texto sobre botones --ink */

  /* Semánticos de Interacción de la App */
  --vote:    #c94a4a; /* Corazón ❤️ activo cálido (armonizado con tonos tierra, no neón) */
  --success: #3f6b4e; /* Verde oliva/salvia sobrio para confirmaciones de subida */
  --danger:  #b43c3c; /* Rojo terracota sobrio para errores y eliminar foto */
}
```

---

## 3. Tipografía Oficial (`Cormorant Garamond` + `Montserrat`)

Se cargan exactamente las mismas dos familias tipográficas de la invitación:
- **Display / Editorial (`--font-serif`):** `"Cormorant Garamond", Georgia, serif` (pesos `400, 500, 600` + `italic` para el `&` en *Joa & Maga* y subtítulos).
- **UI y Cuerpo (`--font-sans`):** `"Montserrat", Arial, sans-serif` (pesos `300, 400, 500`, `line-height: 1.55`).

| Elemento | Familia | Tamaño Móvil | Peso / Estilo | Tracking | Uso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Eyebrow / Label` | `Montserrat` | `11px–12px` | `400` Uppercase | `0.18em–0.22em` | Fechas, encabezados chicos (*"ÁLBUM EN VIVO"*, *"COMPETENCIA"*), contadores. |
| `Hero Couple` | `Cormorant Garamond` | `44px–56px` | `500` (`&` en *400 italic*) | `-0.04em` | Encabezado `Joa & Maga` en el Home. |
| `Section Title` | `Cormorant Garamond` | `32px–36px` | `500` | `-0.03em` | Títulos de ruta (*Muro General*, *Best Outfit*). |
| `Card Title` | `Cormorant Garamond` | `24px–26px` | `500` | `-0.02em` | Títulos dentro de las tarjetas Bento del Home. |
| `Editorial Subtitle` | `Cormorant Garamond` | `20px–22px` | `400 italic` | `normal` | Bajadas cálidas y estados vacíos. |
| `Body / Button` | `Montserrat` | `15px` | `400–500` | `normal` | Textos generales, apodos de autores, botones `.btn`. |
| `Form Input` | `Montserrat` | **`16px`** | `400` | `normal` | Inputs de Apodo y Epígrafe (**mín. `16px` obligatorio** para evitar auto-zoom en iOS Safari). |

---

## 4. Geometría, Superficies y Controles Base

Fieles a los componentes CSS de la invitación:
- **Viewport Mobile-First:** Contenedor centrado (`max-width: 480px` en vistas de grilla móvil, `padding: 14px` en pantallas chicas) respetando `env(safe-area-inset-bottom)`.
- **Tarjetas / Secciones (`Surface`):**
  - `background: var(--paper)` (`#fbf8f3`)
  - `border: 1px solid var(--line)` (`#d9cfc2`)
  - `border-radius: 22px` en móvil
  - `box-shadow: 0 10px 30px rgba(64, 54, 44, 0.05)`
- **Divisor Editorial (`.divider`):** Línea centrada `width: 42px; height: 1px; background: var(--line)` para separar bloques con aire.
- **Botón Primario (`.btn`):**
  - `min-height: 48px`, `padding: 0 22px`, `border-radius: 999px` (formato píldora), `background: var(--ink)` (`#2f2b27`), `color: var(--white)`, `font-family: Montserrat`, `font-size: 15px`.
- **Botón Secundario (`.btn-secondary`):**
  - Misma geometría `min-height: 48px`, `border-radius: 999px`, `background: transparent`, `color: var(--ink)`, `border: 1px solid var(--line)`.
- **Inputs de Texto:**
  - `background: var(--white)`, `border: 1px solid var(--line)`, `border-radius: 14px`, `padding: 15px 16px`, `font-size: 16px`, foco `:focus { border-color: var(--accent) }`.

---

## 5. Catálogo de Componentes de la Aplicación

1. **`WeddingHeader`:**
   - En Home (`/`): Eyebrow `07 · 11 · 2026 · ALDEANO`, título `Joa & Maga` con `&` en cursiva, y chip discreto con el Apodo del invitado si ya lo cargó.
   - En secciones (`/galeria`, `/best-outfit`): Barra superior limpia con botón volver (`48x48px`), título en *Cormorant Garamond* y contador sutil.
2. **`LivePreviewCard` + `BentoModuleCard` (Home):**
   - Mini-grilla `2x2` de las últimas 4 fotos en vivo dentro de una tarjeta `--paper` + tarjetas grandes para **Muro General** y **Best Outfit** (y tarjetas en estado `coming_soon` con etiqueta uppercase *"PRÓXIMAMENTE"* si están visibles).
3. **`NewPhotosPill` (Aviso de Polling cada 20s):**
   - Pildorita flotante superior suave (`background: var(--ink)`, `color: var(--white)`, `border-radius: 999px`) con texto *"✨ Hay fotos nuevas — Tocá para ver"*, evitando saltos bruscos de scroll mientras el invitado mira fotos.
4. **`PhotoGrid` & `ContestEntryCard`:**
   - Grilla de **2 columnas** (`gap: 10px`), miniaturas `400px` con `border-radius: 16px` y fondo placeholder `--bg` mientras cargan.
   - En *Best Outfit*: relación vertical `4:5` (ideal para ver el look *"Elegante sport"* completo), nombre del autor, epígrafe corto opcional y botón de corazón ❤️ táctil con contador en vivo.
5. **`LazyAliasSheet` (Onboarding sin fricción):**
   - *Bottom Sheet* en `--paper` con bordes superiores `22px` que **solo se abre la primera vez que el invitado toca Subir o ❤️**: *"¿Cómo te llamás?"* + 1 input + botón pill *"Continuar"*.
6. **`UploadProgressSheet`:**
   - Muestra en español cercano el progreso real de compresión en el teléfono y subida, con botón de **"Reintentar"** en 1 toque si la señal móvil en La Calera pestañea.
7. **`PhotoLightbox`:**
   - Vista ampliada a pantalla completa sobre velo cálido oscuro, botón **Descargar foto** individual y —solo para el autor de esa foto o el Moderador con PIN— botón **Eliminar** con confirmación simple.
