import { supabase } from './db.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    // Get user info
    const { data: userData } = await supabase
      .from('users')
      .select('id, username, email, created_at')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Get last post
    const { data: lastPost } = await supabase
      .from('posts')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextPostTime = null;
    if (lastPost) {
      const createdAt = new Date(lastPost.created_at);
      nextPostTime = new Date(createdAt.getTime() + 60 * 60 * 1000);
    }

    res.json({
      user: userData,
      nextPostTime,
      canPostNow: !nextPostTime || Date.now() >= nextPostTime.getTime()
    });
  } catch (error) {
    console.error('Error obteniendo user info:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}
