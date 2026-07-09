# Rúbrica de Virtualización — Azure + CI/CD + Red con Servicio Web

> Mapeo punto por punto de la segunda rúbrica. Los archivos ya están en el repo;
> aquí van los pasos que se ejecutan una sola vez (Azure, GitHub, red).

## 1. Arquitectura

```
                    GitHub (repo)
        feature/* ──PR──▶ develop ──merge──▶ main
                            │                  │
                        [CI: ci.yml]      [CD: deploy-azure.yml]
                     typecheck + build      build imágenes ──▶ ghcr.io
                                                   │
                                                   ▼
   ┌────────────────────────── AZURE ──────────────────────────┐
   │  App Service (front)      App Service (back)      Azure    │
   │  nginx + build Vite  ──▶  Express + Prisma   ──▶  PostgreSQL│
   │  contenedor ghcr           contenedor ghcr        Flexible │
   └─────────────────────────────────────────────────────────────┘

   LOCAL (red montada): Docker Compose = db (5433) + back (4000) + front (8080/8443)
```

## 2. Ramas y flujo CI/CD (ya configurado en `.github/workflows/`)

| Rama | Rol | Pipeline |
|---|---|---|
| `feature/<nombre>` | Trabajo diario | CI en el Pull Request |
| `develop` | Integración | `ci.yml`: typecheck + build front/back + build Docker |
| `main` | Producción | `deploy-azure.yml`: publica imágenes en GHCR y actualiza Azure |

Flujo para la demo: crear `feature/mi-cambio` → commit → PR a `develop` (se ve el CI
verde) → merge → PR de `develop` a `main` → merge → se dispara el deploy a Azure.

## 3. Despliegue en Azure (una sola vez, con `az` CLI)

Con la suscripción **Azure for Students** ($100 USD, sin tarjeta):

```bash
az login
az group create -n rg-fantasy -l eastus

# --- Base de datos (host DB en Azure) ---
az postgres flexible-server create -g rg-fantasy -n fantasy-db-danyl \
  --sku-name Standard_B1ms --tier Burstable --storage-size 32 \
  --admin-user fantasy --admin-password "<PASSWORD-FUERTE>" \
  --public-access 0.0.0.0   # permite servicios de Azure
az postgres flexible-server db create -g rg-fantasy -s fantasy-db-danyl -d fantasy

# --- Plan + App Services con contenedor (host front y host back) ---
az appservice plan create -g rg-fantasy -n plan-fantasy --is-linux --sku B1

az webapp create -g rg-fantasy -p plan-fantasy -n fantasy-back-danyl \
  --container-image-name ghcr.io/<usuario>/<repo>-back:latest
az webapp config appsettings set -g rg-fantasy -n fantasy-back-danyl --settings \
  DATABASE_URL="postgresql://fantasy:<PASSWORD>@fantasy-db-danyl.postgres.database.azure.com:5432/fantasy?sslmode=require" \
  JWT_SECRET="<SECRETO-LARGO>" PORT=4000 WEBSITES_PORT=4000

az webapp create -g rg-fantasy -p plan-fantasy -n fantasy-front-danyl \
  --container-image-name ghcr.io/<usuario>/<repo>-front:latest
az webapp config appsettings set -g rg-fantasy -n fantasy-front-danyl --settings \
  BACKEND_URL="https://fantasy-back-danyl.azurewebsites.net" WEBSITES_PORT=80
```

> Si el paquete de GHCR queda privado: en GitHub → Package → Settings → hazlo público,
> o configura credenciales de registry en el App Service.

Después: crear el service principal (`AZURE_CREDENTIALS`) y las variables `AZURE_RG`,
`AZURE_APP_BACK`, `AZURE_APP_FRONT` como dice el encabezado de `deploy-azure.yml`,
y cada merge a `main` despliega solo.

## 4. Red montada con servicio web (local, elegimos Docker sobre IIS)

**Servicio montado:** `docker compose --profile full up -d --build` levanta los 3 hosts:

| Host | Contenedor | Puerto |
|---|---|---|
| Front | `fantasy-frontend` (nginx) | 8080 (8443 con SSL) |
| Back | `fantasy-backend` (node) | 4000 |
| DB | `fantasy-db` (postgres) | 5433 — o usar la de Azure cambiando `DATABASE_URL` |

**Dominio para la red:** en el equipo que hace de servidor (o en un DNS del router/AD):

1. Averigua tu IP local: `ipconfig` (ej. `192.168.1.50`).
2. En cada cliente de la red edita `C:\Windows\System32\drivers\etc\hosts` (como admin):
   ```
   192.168.1.50  fantasy.local
   ```
   (Con Windows Server: crear zona DNS `fantasy.local` + registro A — se ve más pro en la defensa.)
3. Abre el firewall del servidor: `netsh advfirewall firewall add rule name="Fantasy" dir=in action=allow protocol=TCP localport=8080,8443`
4. Los clientes entran a `http://fantasy.local:8080`.

**Alternativa IIS (por si preguntan):** IIS serviría el build de Vite como sitio estático
y haría de reverse proxy al backend con ARR/URL Rewrite. Elegimos Docker porque empaqueta
las mismas imágenes que corren en Azure (paridad dev-prod).

## 5. BONUS certificado (+1)

```bash
mkdir certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/fantasy.key -out certs/fantasy.crt \
  -subj "/CN=fantasy.local" -addext "subjectAltName=DNS:fantasy.local,DNS:localhost"

docker compose --profile full -f docker-compose.yml -f docker-compose.ssl.yml up -d --build
```

Queda `https://fantasy.local:8443`. Para que el navegador no marque advertencia,
importa `fantasy.crt` en "Entidades de certificación raíz de confianza" del cliente
(`certmgr.msc`). Nota para la defensa: es un certificado **autofirmado**; en Azure el
`*.azurewebsites.net` ya trae TLS válido de fábrica — menciona ambos.

## 6. Serie de preguntas — respuestas cortas para la defensa

- **¿Qué es CI/CD?** CI: cada cambio se integra y valida automáticamente (compilar,
  probar). CD: lo que pasa la validación se despliega automático. Aquí: CI en
  `develop`/PRs, CD a Azure al hacer merge a `main`.
- **¿Por qué ramas?** `main` siempre desplegable, `develop` integra, `feature/*` aísla
  el trabajo; los PRs disparan el CI antes del merge (calidad antes de integrar).
- **¿Qué es un pipeline?** Serie de pasos automatizados que se disparan con un evento
  del repo (push/PR). Los nuestros: `ci.yml` y `deploy-azure.yml` (GitHub Actions).
- **¿Docker vs IIS?** IIS = servidor web de Windows (sirve sitios/apps .NET, proxy con
  ARR). Docker = contenedores portables con TODA la app (front nginx, back node, db
  postgres); la misma imagen corre local y en Azure. Por eso lo elegimos.
- **¿Contenedor vs máquina virtual?** La VM virtualiza hardware completo con su propio
  SO (GB, minutos en arrancar); el contenedor comparte el kernel y solo empaqueta la
  app y sus dependencias (MB, segundos). Docker Desktop en Windows usa una VM ligera
  (WSL2) donde corren los contenedores Linux.
- **¿Qué servicios de Azure usan?** 2 App Service Linux con contenedores (front y back),
  Azure Database for PostgreSQL Flexible Server, imágenes en GitHub Container Registry.
- **¿Cómo se conecta el front al back?** nginx del front hace reverse proxy de `/api`
  al backend (variable `BACKEND_URL`); el back se conecta a la DB con `DATABASE_URL`
  (con `sslmode=require` en Azure).
- **¿Qué pasa si falla el deploy?** El pipeline se marca en rojo y la versión anterior
  sigue corriendo (la imagen previa no se reemplaza hasta que el push a GHCR y el
  `az webapp config container set` terminan bien).
- **¿Seguridad?** Contraseñas hasheadas (bcrypt), sesiones JWT, secretos en GitHub
  Secrets y App Settings de Azure (nunca en el código), TLS en Azure por defecto y
  certificado propio en la red local (bonus).
