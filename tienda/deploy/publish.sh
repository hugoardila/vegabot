#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  publish.sh — Construye y sube el backend a Docker Hub              ║
# ║  Uso: bash deploy/publish.sh tu-usuario-dockerhub                   ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -e  # Sale si cualquier comando falla

DOCKERHUB_USER=${1:-"vega234"}
IMAGE_NAME="vega234/baken"
TAG="latest"

echo "▶ Construyendo imagen: $IMAGE_NAME:$TAG"
docker build -t "$IMAGE_NAME:$TAG" ./back

echo "▶ Iniciando sesión en Docker Hub..."
docker login

echo "▶ Subiendo imagen a Docker Hub..."
docker push "$IMAGE_NAME:$TAG"

echo ""
echo "✅ Listo. Ahora en tu servidor Ubuntu ejecuta:"
echo "   docker compose -f docker-compose.prod.yml pull api"
echo "   docker compose -f docker-compose.prod.yml up -d api"
