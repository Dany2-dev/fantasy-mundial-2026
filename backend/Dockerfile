FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 4000

# Solo sincroniza el esquema al arrancar. Los datos de referencia (competencias,
# equipos, jugadores…) se cargan aparte, vía POST /api/admin/load-reference-data
# (ver src/routes/admin.ts) — no en cada arranque del contenedor.
#
# --accept-data-loss: sin TTY (dentro del contenedor) prisma db push ABORTA si
# un cambio implica pérdida de datos, y el contenedor entra en crash-loop (503).
# Nuestra migración a economía por liga ELIMINA User.coins a propósito, así que
# aceptamos esa pérdida explícitamente para que el arranque no se bloquee.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/index.js"]
