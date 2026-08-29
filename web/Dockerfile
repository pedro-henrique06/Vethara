# O Node so existe no estagio de build. O que vai para producao e um nginx
# servindo arquivos estaticos — nada de runtime JavaScript no servidor.
FROM node:22-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
