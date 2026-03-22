#!/bin/bash

echo "🌙 Iniciando Momento..."

cd "$(dirname "$0")"

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Verificar si la DB existe
if [ ! -f "momento.db" ]; then
    echo "🔧 Inicializando base de datos..."
    npm run init-db
fi

# Crear carpeta de uploads si no existe
mkdir -p uploads

echo "🚀 Arrancando servidor..."
npm start
