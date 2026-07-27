# Fantasy Mundial 2026 — Contexto de trabajo (Derek)

Proyecto integrador de Diseño de Interfaces. Fantasy del Mundial 2026 estilo FUT:
sobres, colección, once ideal, ligas privadas. Stack: **frontend** React 19 + Vite +
TypeScript + Redux Toolkit + CSS Modules; **backend** Node + Express + Prisma +
PostgreSQL (Docker).

## Reglas del jefe de equipo (OBLIGATORIAS, no negociables)

- Trabajar **solo en mi rama `DEREK`**, nunca tocar/subir a `main`.
- Cada integrante mejora el diseño visual de 2 páginas. **Las mías: Mi Once y Sobres.**
- **No modificar el backend** (`backend/`) — ni una línea.
- **No modificar componentes compartidos existentes** en `frontend/src/components/`
  (`PlayerCard`, `FlipReveal`, `Layout`, `icons.tsx`, `Flag`, etc.). Si hace falta
  tocar uno, avisar primero al compañero que también lo usa.
- Componentes **nuevos** que solo yo uso (ver abajo) sí están permitidos —
  no son "modificar" nada existente.
- Todo cambio va primero a mi rama; el PR se abre `DEREK` → `develop` (no a `main`).
- Antes de cualquier commit, verificar con `git status`/`git diff` que solo aparecen
  mis archivos (páginas propias + componentes nuevos), nunca `backend/` ni
  componentes existentes.

## Mis páginas asignadas

| Página | Ruta | Archivos |
|---|---|---|
| **Mi Once** | `/once` | `frontend/src/pages/Squad.tsx` + `Squad.module.css` |
| **Sobres** | `/sobres` | `frontend/src/pages/Packs.tsx` + `Packs.module.css` |

## Cómo levantar el proyecto en local

```bash
# 1. Base de datos (con Docker Desktop abierto)
docker compose up -d db

# 2. Backend (si es un checkout nuevo, primero: cd backend && npm install
#    && npx prisma db push && npm run db:seed)
cd backend && npm run dev          # puerto 4000

# 3. Frontend (si es checkout nuevo: cd frontend && npm install)
cd frontend && npm run dev         # puerto 5173, proxy /api -> 4000
```

Abrir `http://localhost:5173`. Usuario de prueba local: `derek@test.local` /
`test1234` (crear cuenta nueva si la base de datos es nueva; el registro da
15,000 monedas). Para pruebas, subir monedas directo en la DB:
```bash
docker exec fantasy-db psql -U fantasy -d fantasy -t -c "UPDATE \"User\" SET coins=1000000 WHERE email='...';"
```

⚠️ Si hiciste `git pull` y el equipo agregó dependencias nuevas, correr
`npm install` en `backend/` y/o `frontend/` antes de `npm run dev`, si no el
servidor se cae al arrancar.

## Componentes nuevos que creé (no tocan nada compartido)

Viven en `frontend/src/components/`, cada uno **solo lo usa mi página**:

- **`TiltCard`** — motor de inclinación 3D + brillo holográfico al pasar el
  cursor (adaptado de "ProfileCard" de React Bits). Usado en Sobres.
- **`ColorBends`** — fondo animado con shader WebGL/three.js, coloreado por
  tier. Usado en el overlay de revelado de Sobres. *(dependencia nueva: `three`)*
- **`Galaxy`** — fondo de estrellas animado WebGL/ogl para toda la página de
  Sobres. *(dependencia nueva: `ogl`)*

**Importante:** estas 2 dependencias (`three`, `ogl`) se agregaron a
`frontend/package.json` — avisar al equipo que corran `npm install` después
de hacer pull de mi rama.

## Estado actual — Sobres (`Packs.tsx`)

- 4 sobres (bronce/plata/oro/legendario), cada uno con `TiltCard` (tilt 3D +
  brillo holográfico con la paleta de color de su propio tier, reutilizando
  `--foil-*` de `variables.css`).
- Animación de entrada: los sobres se deslizan de izquierda a derecha, uno
  por uno, al entrar a la página.
- Al hacer clic en "Abrir": la tarjeta "carga energía" (pulso con el color
  del tier + moneda girando en el botón) mientras espera la respuesta.
- Al resolver: destello a pantalla completa del color del tier, luego el
  overlay de revelado con fondo animado `ColorBends` (coloreado por tier) y
  las cartas de `FlipReveal` (componente compartido, sin tocar) más grandes
  (`transform: scale(1.4)` aplicado desde fuera, sin modificar `FlipReveal`).
- Fondo general de toda la página: `Galaxy` (estrellas animadas), con las
  tarjetas de sobre con fondo transparente + `backdrop-filter: blur` para
  que se vea la galaxia detrás.
- Todo respeta `prefers-reduced-motion` (se desactivan las animaciones WebGL
  si el usuario lo prefiere).

## Estado actual — Mi Once (`Squad.tsx`)

- Cancha con perspectiva (trapecio vía `clip-path`, pasto pintado 100% con
  CSS — sin foto externa, para evitar cualquier problema de carga/cobertura).
  Las cartas no heredan ninguna deformación (se ven "de pie"), solo cambian
  de tamaño por fila (`SCALE_TOP`/`SCALE_BOTTOM`) para dar sensación de
  profundidad.
- Altura de la cancha calculada como `100vh - margen reservado` (no un %vh
  fijo) para que quepa completa sin cortarse en pantallas de escritorio
  normales, con margen extra probado incluso con mensajes de error visibles.
- **Banca de jugadores** (columna derecha): todos los jugadores de la
  colección que NO están en el once, agrupados por posición.
- **Arrastrar y soltar**: banca→cancha (llena o intercambia si la posición
  coincide), cancha→banca (quita del once), cancha→cancha (reacomoda). El
  flujo anterior de clic en slot vacío → elegir de una lista sigue intacto
  (drag nativo no funciona bien en touch, así que móvil usa esa lista).

### 🐛 Pendiente conocido (no arreglado aún, no crítico)
Al cambiar de formación (`changeFormation`), si el capitán actual ya no
encaja en la nueva formación, **no se limpia el `captainId`** — el usuario
solo se entera al guardar (`El capitán debe estar en el once`, error real
del backend). El resto de flujos (quitar con X, arrastrar a la banca) sí
limpian el capitán correctamente. Si se retoma este trabajo, buscar
`function changeFormation` en `Squad.tsx` y limpiar `captainId` ahí si el
jugador capitán quedó fuera de `slots`.

## Flujo de git para subir cambios

```bash
git branch --show-current   # debe decir DEREK
git status                  # confirmar que solo aparecen mis archivos
git add <archivos específicos>   # nunca "git add ." a ciegas
git commit -m "..."
git push
```
PR en GitHub: base `develop` ← compare `DEREK` (nunca a `main`). URL directa:
`https://github.com/Dany2-dev/fantasy-mundial-2026/compare/develop...DEREK`
