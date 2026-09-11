# Multi-stage build
# Stage 1: Build
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para compilar
RUN apk add --no-cache git

# Copiar archivos de módulos
COPY go.mod go.sum ./
RUN go mod download

# Copiar el resto del código
COPY . .

# Compilar el binario desde la ruta correcta
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api/main.go

# Stage 2: Run
FROM alpine:latest

WORKDIR /app

# Copiar el binario y el esquema SQL
COPY --from=builder /app/main .
COPY --from=builder /app/schema.sql .
# COPY --from=builder /app/.env . # Opcional: pasar variables por docker-compose

# Puerto expuesto
EXPOSE 8080

# Comando para ejecutar la app
CMD ["./main"]
