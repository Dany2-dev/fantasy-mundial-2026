FROM node:22-alpine
WORKDIR /app
# postgresql-client (psql): lo usa docker-entrypoint.sh para el reset/carga de la
# BD cuando RESET_DB=1 (la Postgres de Azure no es alcanzable desde fuera de
# Azure, así que la carga se hace desde aquí, que sí la alcanza por red interna).
RUN apk add --no-cache postgresql-client
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 4000

# El arranque real vive en docker-entrypoint.sh:
#  - normal: prisma db push (idempotente) + node
#  - con RESET_DB=1: primero borra y recarga la BD desde azure_seed.sql
#
# --accept-data-loss: sin TTY (dentro del contenedor) prisma db push ABORTA si
# un cambio implica pérdida de datos, y el contenedor entra en crash-loop (503).
# Nuestra migración a economía por liga ELIMINA User.coins a propósito, así que
# aceptamos esa pérdida explícitamente para que el arranque no se bloquee.
CMD ["sh", "./docker-entrypoint.sh"]
