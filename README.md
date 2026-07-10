# Fantasy Mundial 2026 — Proyecto Integrador DDI 2026

Fantasy del Mundial 2026 con mecánica de colección de cartas estilo FUT: sobres,
colección, once ideal, ligas privadas con **exclusividad de cartas por liga** e
intercambios entre mánagers.

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

1. Registrarse → recibes 15,000 monedas.
2. Crear una liga privada (o unirse con código de invitación).
3. Abrir sobres (Bronce/Plata/Oro) — las cartas son **exclusivas por liga**: si un
   amigo ya tiene a Mbappé en tu liga, no te puede salir en un sobre.
4. Armar tu once con formación y capitán.
5. Proponer intercambios (carta + monedas) a otros mánagers de la liga.

<!-- verificaci�n de pipeline CI/CD -->
<!-- trigger ci -->
