# 🚀 Deploy en Vercel - Momento

---

## 📋 Paso 1: Crear DB en Supabase

1. Ve a https://supabase.com
2. Sign up con GitHub
3. **"New Project"**
   - Name: `momentos-db`
   - Database Password: **GUÁRDALA** (la necesitarás)
   - Region: `Madrid (eu-west-3)`
4. Espera 2 minutos

5. Ve a **SQL Editor** y ejecuta:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  image TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  is_permanent INTEGER DEFAULT 0
);

CREATE TABLE saves (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_expires ON posts(expires_at);
CREATE INDEX idx_saves_post ON saves(post_id);
```

6. Ve a **Settings** → **API** y copia:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbG...`

---

## 📋 Paso 2: Configurar Vercel

1. Ve a https://vercel.com
2. Sign up con GitHub
3. **"Add New Project"**
4. Importa tu repo: `nxtry-of/Momentos`
5. **Configure Project:**
   - Framework Preset: `Other`
   - Build Command: `echo 'Build complete'`
   - Output Directory: `public`
   - Install Command: `npm install`

6. **Environment Variables** (añade estas):
   ```
   SUPABASE_URL = https://xxxxx.supabase.co
   SUPABASE_ANON_KEY = eyJhbG...
   JWT_SECRET = momento-super-secreto-2026-cambia-esto
   ```

7. Click **"Deploy"**

---

## 📋 Paso 3: Esperar el deploy

- Vercel va a instalar dependencias (~1-2 min)
- Deployará las funciones serverless
- Te dará una URL: `https://momentos-social.vercel.app`

---

## 📋 Paso 4: Probar

1. Abre tu URL de Vercel
2. Regístrate con un usuario
3. Publica un post
4. ¡Debería funcionar!

---

## 🔧 Comandos locales (opcional)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy desde terminal
cd /home/darkness/Red\ Social
vercel

# Deploy a producción
vercel --prod
```

---

## ⚠️ Importante: Imágenes

Vercel no permite subir archivos directamente. Para las imágenes tienes 2 opciones:

### Opción A: Cloudinary (gratis)

1. https://cloudinary.com/users/register/free
2. Crea cuenta gratis
3. Añade las variables:
   ```
   CLOUDINARY_CLOUD_NAME=xxx
   CLOUDINARY_API_KEY=xxx
   CLOUDINARY_API_SECRET=xxx
   ```
4. Crea endpoint `/api/upload.js` para subir imágenes

### Opción B: Supabase Storage

1. En Supabase, ve a **Storage**
2. Crea bucket: `uploads`
3. Hazlo público
4. Usa el SDK para subir imágenes

---

## 🐛 Troubleshooting

### "Module not found"
- Asegúrate de que `package.json` está en la raíz
- Ejecuta `npm install` local y haz push

### "Function error"
- Revisa los logs en Vercel: Deployments → Click en deploy → Functions
- Verifica las variables de entorno

### "CORS error"
- Los headers CORS ya están en las funciones
- Asegúrate de que el frontend llama a `/api/xxx`

---

## 📊 Límites de Vercel Free

| Límite | Valor |
|--------|-------|
| Bandwidth | 100 GB/mes |
| Functions | 100 GB-horas |
| Requests | Ilimitados |
| Domains | Ilimitados |

Para una app pequeña como Momento, es más que suficiente.

---

## 🎯 Siguientes pasos

1. ✅ Deploy en Vercel
2. ✅ Configurar Supabase
3. ✅ Probar registro/login
4. ✅ Probar posts
5. ✅ Probar saves
6. 📱 Compartir URL

---

_URL de Vercel: `https://momentos-social.vercel.app`_
