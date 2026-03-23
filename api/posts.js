import { supabase } from './db.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return getPosts(req, res);
  } else if (req.method === 'POST') {
    return createPost(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getPosts(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (e) {}
    }

    const { data: posts } = await supabase
      .from('posts')
      .select(`
        id, content, image, created_at, expires_at, is_permanent, user_id,
        users!inner(username)
      `)
      .or(`is_permanent.eq.1,expires_at.gt.${new Date().toISOString()}`)
      .order('is_permanent', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (!posts) return res.json([]);

    // Get save counts and user's saves
    const postsWithSaves = await Promise.all(posts.map(async post => {
      const { count: saveCount } = await supabase
        .from('saves')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      let savedByCurrent = false;
      if (userId) {
        const { data: userSave } = await supabase
          .from('saves')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', userId)
          .single();
        savedByCurrent = !!userSave;
      }

      return {
        ...post,
        username: post.users.username,
        save_count: saveCount || 0,
        saved_by_current: savedByCurrent
      };
    }));

    res.json(postsWithSaves);
  } catch (error) {
    console.error('Error obteniendo posts:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

async function createPost(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(403).json({ error: 'Token inválido' });
    }

    const { content, image } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'El contenido no puede estar vacío' });
    }

    // Check last post time
    const { data: lastPost } = await supabase
      .from('posts')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastPost) {
      const createdAt = new Date(lastPost.created_at);
      const nextPostTime = new Date(createdAt.getTime() + 60 * 60 * 1000);
      
      if (Date.now() < nextPostTime.getTime()) {
        const minutesLeft = Math.ceil((nextPostTime - Date.now()) / 60000);
        return res.status(429).json({ 
          error: 'Solo puedes publicar una vez cada hora',
          nextPostIn: `${minutesLeft} minutos`
        });
      }
    }

    const id = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('posts')
      .insert([{
        id,
        user_id: user.id,
        content: content.trim(),
        image: image || null,
        expires_at: expiresAt
      }]);

    if (error) throw error;

    res.json({
      id,
      content: content.trim(),
      image: image || null,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_permanent: 0,
      user_id: user.id,
      username: user.username,
      save_count: 0,
      saved_by_current: 0
    });
  } catch (error) {
    console.error('Error creando post:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}
