FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 4000

# Solo sincroniza el esquema al arrancar. El seed con datos reales de FotMob
# (npm run db:seed:fotmob) es una operación manual y deliberada, no algo que
# deba correr solo cada vez que se reinicia el contenedor.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
