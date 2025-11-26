FROM node:18-alpine

WORKDIR /app

# Copiar package.json y package-lock.json y instalar dependencias
COPY package*.json ./
RUN npm install --production

# Copiar todo el proyecto
COPY . .

EXPOSE 10000

ENV PORT=10000

CMD ["node", "server.js"]
