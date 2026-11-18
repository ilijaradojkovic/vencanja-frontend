# syntax=docker/dockerfile:1

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

# nginx servira dist/; svaka nepoznata putanja (/i/:token, /app/gosti…) vraća index.html
# da bi direktni linkovi i refresh radili (React Router preuzima).
# ${PORT} se popunjava pri startu – platforme za deploy ga često postavljaju same.
COPY <<'EOF' /etc/nginx/templates/default.conf.template
server {
    listen ${PORT};
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

COPY --from=build /app/dist /usr/share/nginx/html

ENV PORT=80
EXPOSE 80
