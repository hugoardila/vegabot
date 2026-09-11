# Vega Importadora

Plataforma de ventas que integra un bot conversacional por WhatsApp, panel administrativo, tienda virtual, inventario sincronizado con SAINT, pagos Wompi y facturacion en espera.

## Componentes

- Backend principal en Node.js y Express.
- Panel administrativo del bot en `public/`.
- Tienda React, TypeScript y Vite en `tienda/front/`.
- Backend Go heredado de la tienda en `tienda/back/`.
- Persistencia principal en MySQL.
- Integraciones con Twilio WhatsApp, OpenAI, Google OAuth, Wompi y SQL Server SAINT.

## Instalacion rapida

1. Instalar Node.js 20 o superior, MySQL y Git.
2. Copiar `.env.example` como `.env` y completar solo las variables necesarias.
3. Instalar el backend desde la raiz con `npm install`.
4. Instalar la tienda con `cd tienda/front` y `npm install`.
5. Compilar la tienda con `npm run build`.
6. Iniciar la aplicacion desde la raiz con `npm start`.

El panel administrativo permite completar las credenciales de Twilio, OpenAI, Wompi, Google y SAINT. Nunca deben agregarse claves reales al repositorio.

## Datos no versionados

GitHub contiene el codigo completo, pero excluye deliberadamente bases de datos, copias SQL, logs, conversaciones, comprobantes, facturas, dependencias, compilaciones y archivos cargados por usuarios. El contenido de `storage/store-uploads` debe respaldarse por separado.

Consulta [REQUISITOS.md](REQUISITOS.md) para la guia completa de instalacion, migracion y operacion.
