FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
ENV BACKEND_URL=http://backend:4000
COPY --from=build /app/dist /usr/share/nginx/html
# nginx:alpine corre envsubst sobre /etc/nginx/templates/*.template al arrancar
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
