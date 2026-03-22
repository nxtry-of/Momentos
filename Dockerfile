FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código
COPY . .

# Crear carpeta uploads
RUN mkdir -p /app/uploads

# Puerto
EXPOSE 3000

# Iniciar
CMD ["node", "server.js"]
