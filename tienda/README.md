# Guía de Configuración y Ejecución del Proyecto

¡Bienvenido! Este documento detalla los pasos exactos para configurar y levantar el entorno de desarrollo en un computador nuevo desde cero. 

El proyecto está dividido en dos partes principales:
- **`back`**: El backend desarrollado en Go y contenedorizado con Docker.
- **`front`**: El frontend que utiliza Node.js y el gestor de paquetes pnpm.

---

## 1. Requisitos Previos e Instalación de Software

Antes de empezar, debes instalar las siguientes herramientas en tu sistema:

1. **Go (Golang) v1.26.1**
   - El backend requiere Go versión **1.26.1**. Descarga e instala esta versión desde su página oficial: [https://go.dev/dl/](https://go.dev/dl/).
   
2. **Docker Desktop**
   - Descarga e instala Docker para poder correr los contenedores del backend: [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).
   - *Nota: Asegúrate de abrir la aplicación de Docker Desktop para que el motor de Docker esté en ejecución antes de continuar.*

3. **Node.js v20.x**
   - El frontend está optimizado para Node.js v20 (recomendado v20.5 o superior). Descarga e instala esta versión desde [https://nodejs.org/](https://nodejs.org/).

4. **pnpm**
   - Una vez que tengas Node.js instalado, abre una terminal e instala pnpm globalmente con el siguiente comando:
     ```bash
     npm install -g pnpm
     ```

---

## 2. Configuración y Ejecución del Backend (`/back`)

1. **Abre una terminal** y navega a la carpeta del backend:
   ```bash
   cd back
   ```

2. **Crear el archivo de variables de entorno (`.env`)**
   - Crea un archivo llamado `.env` en la raíz de la carpeta `back`.
   - Si existe un archivo `.env.example` o `.env.template`, cópialo como `.env` y rellena los valores.
   - *Contacta al equipo de desarrollo para que te faciliten las credenciales y variables de entorno correctas.*

3. **Levantar el contenedor con Docker**
   - Asegúrate de que Docker Desktop esté corriendo.
   - Ejecuta el comando para construir y levantar el contenedor del backend (generalmente con Docker Compose o el script configurado):
     ```bash
     docker-compose up -d
     ```
     *(Si el proyecto tiene un comando específico diferente en un Makefile, utiliza ese comando, por ejemplo `make run` o `docker build ...`).*

4. **Descargar las dependencias de Go (Opcional)**
   - Para asegurarte de tener todas las dependencias locales del código:
     ```bash
     go mod tidy
     ```

---

## 3. Configuración y Ejecución del Frontend (`/front`)

1. **Abre una nueva pestaña en tu terminal** y navega a la carpeta del frontend:
   ```bash
   cd front
   ```

2. **Instalar dependencias**
   - Ejecuta el siguiente comando para descargar e instalar todas las dependencias de Node definidas en el proyecto:
     ```bash
     pnpm install
     ```

3. **Levantar el entorno de desarrollo**
   - Una vez terminada la instalación, arranca el servidor local:
     ```bash
     pnpm run dev
     ```

4. **Acceder a la aplicación**
   - Revisa la consola donde ejecutaste el comando anterior. Allí aparecerá la URL local (por ejemplo, `http://localhost:5173` o `http://localhost:3000`) donde podrás ver la aplicación funcionando en tu navegador.
