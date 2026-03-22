# 🌙 Momento

Red social efímera con un twist: **publica solo 1 vez cada hora** y todo desaparece en **24 horas**... a menos que la comunidad lo salve.

## ✨ Características

- **🕐 Publicación limitada**: Solo 1 post por hora por usuario
- **⏳ Contenido efímero**: Los posts desaparecen después de 24 horas
- **💾 Sistema de "Salvado"**: La comunidad puede salvar posts (10+ saves = permanente)
- **📸 Imágenes**: Soporte para subir imágenes con tus posts
- **🔐 Autenticación**: Registro y login con JWT

## 🚀 Inicio rápido

```bash
# Navega a la carpeta
cd "/home/darkness/Red Social"

# Instala dependencias
npm install

# Inicializa la base de datos
npm run init-db

# Arranca el servidor
npm start
```

Abre http://localhost:3000 en tu navegador.

## 🛠️ Comandos

```bash
npm start          # Inicia el servidor
npm run dev        # Modo desarrollo con auto-reload
npm run init-db    # Inicializa la base de datos
npm run cleanup    # Limpia posts expirados
```

## 📡 API

### Auth
- `POST /api/register` - Registrar usuario
- `POST /api/login` - Login
- `GET /api/me` - Info del usuario actual

### Posts
- `GET /api/posts` - Obtener feed de posts
- `POST /api/posts` - Crear post (1/hora)
- `POST /api/posts/:id/save` - Salvar post
- `DELETE /api/posts/:id/save` - Quitar save

### Mantenimiento
- `POST /api/cleanup` - Limpiar posts expirados

## 🔄 Limpieza automática

Para limpiar posts expirados automáticamente, añade un cron job:

```bash
# Ejecutar cada hora
0 * * * * cd "/home/darkness/Red Social" && npm run cleanup
```

## 📁 Estructura

```
Red Social/
├── server.js           # Backend Express
├── package.json        # Dependencias
├── momento.db          # SQLite database (auto-generada)
├── scripts/
│   ├── init-db.js      # Inicializar DB
│   └── cleanup-expired.js # Limpieza
├── public/
│   └── index.html      # Frontend
└── uploads/            # Imágenes subidas
```

## 🎨 Concepto

**Momento** es para compartir lo que importa **ahora**, sin la presión de crear contenido "perfecto" que vivirá para siempre. 

- ¿Algo gracioso que pasó? → Postéalo
- ¿Una foto del atardecer? → Postéalo
- ¿Un pensamiento random? → Postéalo

Si es realmente bueno, la comunidad lo salvará y será permanente. Si no... desaparece y listo. Sin regrets.

---

Hecho con 🌙 por Kimi para Dark
