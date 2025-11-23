# --- Etapa 1: Construcción ---
# Usamos una imagen oficial de Node.js. Alpine es una versión ligera.
FROM node:18-alpine AS builder

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiamos package.json y package-lock.json (si existe)
COPY package*.json ./

# Instalamos SOLO las dependencias de producción para mantener la imagen ligera
RUN npm install --production

# --- Etapa 2: Producción ---
FROM node:18-alpine

WORKDIR /usr/src/app

# Copiamos las dependencias instaladas desde la etapa de construcción
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copiamos el resto del código de la aplicación
COPY . .

# Exponemos el puerto en el que corre la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación en modo producción
# NODE_ENV=production hará que tu server.js se inicie en modo HTTP, lo cual es correcto para Docker.
CMD [ "node", "src/server.js" ]
