# Criterio 3 — Sistema de Diseño / UI Kit (30%)

> En Figma: página "UI/Design System" con estilos de color, texto, componentes con
> variantes y auto layout. Estos tokens están replicados 1:1 en
> `frontend/src/styles/variables.css` (consistencia diseño ↔ código, argumento fuerte
> en la defensa).

## 1. Concepto visual

**"Noche de estadio + foil de coleccionable."** El chrome de la UI es oscuro y
silencioso (azul noche) para que las cartas —el héroe del producto— brillen con sus
materiales de rareza. El oro se reserva para lo valioso: monedas, ratings altos, CTA
principal. Anti-referencias: SaaS corporativo, casa de apuestas, app de finanzas.

## 2. Paleta (con contraste WCAG sobre `--noche` #0B1220)

| Token | Hex | Uso | Contraste vs fondo |
|---|---|---|---|
| `--noche` | `#0B1220` | Fondo base | — |
| `--tribuna` | `#151F36` | Superficies/tarjetas | — |
| `--linea` | `#26334F` | Bordes, divisores | — |
| `--crema` | `#F4F6FB` | Texto principal | 16.9:1 ✅ AAA |
| `--gris` | `#9AA7BF` | Texto secundario | 7.4:1 ✅ AAA |
| `--oro` | `#F0C24B` | Acento principal, CTAs, rating | 10.5:1 ✅ AAA |
| `--pasto` | `#3ECF7A` | Éxito, disponible | 9.1:1 ✅ |
| `--rojo` | `#FF6B7A` | Error, peligro | 7.0:1 ✅ |

Posiciones (badges): POR `#F59E0B` · DEF `#5BA8FF` · MED `#3ECF7A` · DEL `#FF6B7A`.
Rareza de carta: **Oro** rating ≥ 85 · **Plata** 78–84 · **Bronce** < 78.

> Texto sobre botón oro: usar `--noche` (#0B1220 sobre #F0C24B = 10.5:1 ✅).

## 3. Tipografía

| Rol | Fuente | Peso | Tamaño/interlínea |
|---|---|---|---|
| Display / H1 | Bricolage Grotesque | 800 | 32/38 |
| H2 | Bricolage Grotesque | 700 | 24/30 |
| H3 / rating de carta | Bricolage Grotesque | 700 | 18/24 |
| Body | Hanken Grotesk | 400 | 16/24 |
| Body strong / botones | Hanken Grotesk | 600 | 16/24 |
| Caption / labels | Hanken Grotesk | 500 | 13/18, tracking +0.4 |

Números tabulares (`font-variant-numeric: tabular-nums`) en monedas, puntos y tablas.

## 4. Rejilla y espaciado

- **Grid:** móvil 4 columnas / margen 16 · desktop 12 columnas / max-width 1100px.
- **Espaciado:** escala de 4 px → 4, 8, 12, 16, 24, 32, 48.
- **Radios:** 8 (inputs), 12 (tarjetas), 16 (cartas de jugador), 999 (chips).

## 5. Componentes y estados (variantes en Figma)

| Componente | Variantes | Estados |
|---|---|---|
| Botón | primario (oro), secundario (borde), fantasma, peligro | default, hover, active, disabled, loading |
| Carta de jugador | bronce/plata/oro × sm/md × con/sin dueño | default, hover (lift), seleccionada, en once |
| Input | texto, código de invitación (auto-mayúsculas) | default, focus, error, disabled |
| Chip posición | POR/DEF/MED/DEL | — |
| Sobre | bronce/plata/oro | cerrado, hover, abriendo (animación) |
| Slot de cancha | vacío (silueta), ocupado, capitán © | default, seleccionado |
| Fila de ranking | normal, "tú" (resaltada), líder 🏆 | — |
| Toast | éxito, error | entra/sale |

## 6. Microinteracciones (Criterio 4)

- **Reveal de sobre:** volteo 3D escalonado (120 ms entre cartas), la de mayor rating
  al final; glow del color de rareza. En Figma: Smart Animate.
- Hover de carta: elevación + brillo del foil (transform 150 ms ease-out).
- `prefers-reduced-motion`: sin volteos, aparición instantánea con fundido.
