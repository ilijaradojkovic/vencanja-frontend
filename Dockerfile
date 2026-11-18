# ---------- 1) build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite ugrađuje VITE_* promenljive u bundle u trenutku build-a.
# Promenljive iz okruženja imaju prednost nad .env fajlovima, pa se ovde mogu pregaziti:
#   docker build --build-arg VITE_USE_MOCK=true --build-arg VITE_ROUTER=hash .
ARG VITE_USE_MOCK=false
ARG VITE_ROUTER=browser
ARG VITE_API_BASE_URL=/api
ENV VITE_USE_MOCK=$VITE_USE_MOCK \
    VITE_ROUTER=$VITE_ROUTER \
    VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---------- 2) serve ----------
FROM nginx:1.27-alpine

# nginx image pri startu radi envsubst nad /etc/nginx/templates/*.template → /etc/nginx/conf.d/
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Gde nginx prosleđuje /api/* zahteve (frontend u produkciji zove /api)
#   /api/weddings/1  →  ${API_UPSTREAM}/weddings/1
ENV API_UPSTREAM=http://backend:8001/api/v1 \
    CLIENT_MAX_BODY_SIZE=100m \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

EXPOSE 80
