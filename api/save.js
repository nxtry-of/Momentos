import { supabase } from './db.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

  if (req.method === 'POST') {
    return savePost(req, res, user);
  } else if (req.method === 'DELETE') {
    return unsavePost(req, res, user);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function savePost(req, res, user) {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Post ID requerido' });
    }

    // Check if post exists
    const { data: post } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    // Check if already saved
    const { data: existing } = await supabase
      .from('saves')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Ya salvaste este post' });
    }

    // Create save
    const { error } = await supabase
      .from('saves')
      .insert([{
        id: uuidv4(),
        post_id: id,
        user_id: user.id
      }]);

    if (error) throw error;

    // Count saves
    const { count } = await supabase
      .from('saves')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', id);

    // Make permanent if 10+ saves
    if (count >= 10 && !post.is_permanent) {
      await supabase
        .from('posts')
        .update({ is_permanent: 1 })
        .eq('id', id);
    }

    res.json({ success: true, saveCount: count, isPermanent: count >= 10 });
  } catch (error) {
    console.error('Error salvando post:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

async function unsavePost(req, res, user) {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Post ID requerido' });
    }

    // Delete save
    const { error } = await supabase
      .from('saves')
      .delete()
      .eq('post_id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    // Count saves
    const { count } = await supabase
      .from('saves')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', id);

    // Remove permanent if < 10 saves
    if (count < 10) {
      await supabase
        .from('posts')
        .update({ is_permanent: 0 })
        .eq('id', id);
    }

    res.json({ success: true, saveCount: count });
  } catch (error) {
    console.error('Error removiendo save:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}
