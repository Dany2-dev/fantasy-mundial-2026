# Fantasy Mundial 2026 — Proyecto Integrador DDI 2026

Fantasy de fútbol con mecánica de colección de cartas estilo FUT: sobres,
colección, once ideal, ligas privadas con **exclusividad de cartas por liga**,
mercado de fichajes (agentes libres, ventas, cláusulas de rescisión) e
intercambios entre mánagers. Incluye además **Tu Leyenda**, un simulador de
carrera de futbolista.

Los datos de competencias, equipos y jugadores son reales (fuente: FotMob), y
toda la economía del juego está en **euros**, a la misma escala que el valor de
mercado real de cada jugador.

> **Materia:** Diseño de Interfaces 8C · **Entregables oficiales:** Figma + Documento técnico + Defensa.
> Este repositorio es el **prototipo funcional** que se presenta ante el sínodo (Criterio 4).

## Estructura

```
fantasy-mundial-2026/
├── docs/          Entregables de la rúbrica (UX, AI, wireframes, design system, pruebas)
├── backend/       API REST — Node + Express + TypeScript + Prisma + PostgreSQL
├── frontend/      SPA — React + Vite + TypeScript + Redux Toolkit + CSS Modules
└── docker-compose.yml
```

## Mapeo con la rúbrica de Diseño de Interfaces

| Criterio | Peso | Entregable |
|---|---|---|
| 1. Investigación y Fase UX | 25% | `docs/01-investigacion-ux.md` + página "UX" en Figma |
| 2. Arquitectura de Información y Wireframes | 20% | `docs/02-arquitectura-informacion.md`, `docs/03-wireframes.md` + página "Wireframes" |
| 3. UI y Sistema de Diseño | 30% | `docs/04-design-system.md` + página "UI/Design System" (tokens replicados en `frontend/src/styles/variables.css`) |
| 4. Prototipado Interactivo | 15% | Prototipo Figma + **esta app funcionando** |
| 5. Pruebas de Usabilidad | 10% | `docs/05-pruebas-usabilidad.md` (protocolo SUS + Think Aloud) |

## Mapeo con la rúbrica de Virtualización

| Requisito | Dónde está |
|---|---|
| Proyecto en Azure (front + back + DB) | `docs/06-virtualizacion-devops.md` §3 (App Services + PostgreSQL Flexible) |
| Pipelines en GitHub | `.github/workflows/ci.yml` y `deploy-azure.yml` |
| Flujo CI/CD con ramas | `main` (deploy) ← `develop` (CI) ← `feature/*` (PRs) |
| Servicio montado en Docker (host front/back/db) | `docker-compose.yml` perfil `full` |
| Red funcional con dominio | `docs/06` §4 (`fantasy.local` vía hosts/DNS) |
| **Bonus** certificado (+1) | `docker-compose.ssl.yml` + `docs/06` §5 |
| Serie de preguntas | `docs/06` §6 (respuestas preparadas) |

## Cómo correr (desarrollo)

Requisitos: Node 20+, Docker Desktop.

```bash
# 1. Base de datos (PostgreSQL en Docker)
docker compose up -d db

# 2. Backend (puerto 4000)
cd backend
npm install
npx prisma db push        # crea las tablas
npm run db:seed           # países + jugadores
npm run dev

# 3. Frontend (puerto 5173, proxy /api → 4000)
cd ../frontend
npm install
npm run dev
```

Abrir <http://localhost:5173>.

## Cómo correr (todo en Docker)

```bash
docker compose --profile full up -d --build
```

Frontend en <http://localhost:8080> (nginx sirve el build y hace proxy de `/api` al backend).

## Flujo principal (para la demo)

1. Registrarse con email, o entrar con **Google** (ver configuración más abajo).
2. Crear una liga privada (o unirse con código de invitación). Cada mánager
   arranca con un presupuesto de **€50M en esa liga** — el dinero no cruza entre
   ligas, cada una es una economía cerrada.
3. Abrir sobres (Bronce €8M / Plata €15M / Oro €30M / Legendario €60M) — las
   cartas son **exclusivas por liga**: si un amigo ya tiene a Mbappé en tu liga,
   no te puede salir en un sobre.
4. Armar tu once con formación y capitán.
5. Fichar en el **Mercado**, que tiene cuatro vías:
   - **Agentes libres:** cada 24 h la liga saca 12 jugadores sin dueño que
     cualquiera puede fichar al contado.
   - **Clausulazo:** pagar la cláusula de un jugador de otro mánager para
     llevártelo sin su permiso (protegido los primeros 7 días tras un fichaje).
   - **Ventas:** publicar una carta a precio fijo.
   - **Intercambios:** carta por carta, con euros de por medio si hace falta.
6. Subir la cláusula de tus cracks para blindarlos.

### Tu Leyenda

Simulador de carrera aparte del fantasy. Creás un futbolista (nombre, dorsal,
país y puesto) y la carrera avanza **en tramos de dos años, de los 16 a los 38**.
Cada tramo presenta dos decisiones —una de futuro (fichaje, cesión, renovación) y
otra de enfoque— con clubes y competencias reales, títulos, premios individuales
y un minijuego de penal que define finales.

## Variables de entorno del backend

Copiar `backend/.env.example` a `backend/.env` y rellenar:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Cadena de conexión de PostgreSQL |
| `JWT_SECRET` | Firma de los tokens de sesión |
| `PORT` | Puerto de la API (4000 por defecto) |
| `SYNC_TOKEN` | Protege el endpoint que dispara la sincronización con FotMob |
| `GOOGLE_CLIENT_ID` | ID de cliente OAuth (tipo *aplicación web*). **Opcional:** si se deja vacío, el botón de "Entrar con Google" simplemente no se muestra y el acceso por email sigue funcionando |

Para el acceso con Google hay que registrar el origen del frontend
(`http://localhost:5173` en desarrollo, la URL del App Service en producción) en
**Orígenes autorizados de JavaScript** de la credencial. No hace falta *client
secret*: el backend solo verifica el token de identidad, nunca intercambia
códigos.
