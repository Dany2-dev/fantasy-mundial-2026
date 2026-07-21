#!/bin/sh
# Arranque del backend. Normalmente solo sincroniza el esquema y levanta el server.
#
# Si RESET_DB=1 (variable temporal en Azure App Settings), ANTES de arrancar:
#   1) borra por completo la BD (DROP SCHEMA public)
#   2) la recarga desde azure_seed.sql (datos de referencia con precios en euros)
# Es un reset controlado y explícito: pon RESET_DB=1, reinicia UNA vez, y luego
# quita/pon en 0 la variable para no repetir el borrado en cada reinicio.
set -e

if [ "$RESET_DB" = "1" ]; then
  echo "🧨 [reset] RESET_DB=1 — borrando y recargando la BD desde azure_seed.sql…"
  psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/azure_seed.sql
  echo "✅ [reset] carga completa."
fi

# Idempotente: si el esquema ya coincide, no hace nada.
npx prisma db push --skip-generate --accept-data-loss

exec node dist/index.js
