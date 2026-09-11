# Frontend build para Vite + React
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json ./
RUN npm install -g pnpm && pnpm install --include=dev
COPY . .
ARG VITE_API_URL=https://srv1.vegaimportadoracolombia.com/api
ARG VITE_WOMPI_PUBLIC_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_WHATSAPP_SUPPORT=573214815817
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WOMPI_PUBLIC_KEY=${VITE_WOMPI_PUBLIC_KEY}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_WHATSAPP_SUPPORT=${VITE_WHATSAPP_SUPPORT}
RUN pnpm build

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
