# ---------- 1) build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Deploy je test verzija – radi isto kao lokalno, sa mock backend-om (src/mock),
# podaci se čuvaju u localStorage browsera, ne zove se pravi BE.
ENV VITE_USE_MOCK=true \
    VITE_ROUTER=browser

RUN npm run build

# ---------- 2) serve ----------
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
