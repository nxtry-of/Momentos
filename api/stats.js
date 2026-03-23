import { supabase } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Total posts
    const { count: totalPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });

    // Posts permanentes
    const { count: permanentPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_permanent', 1);

    // Usuarios únicos
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Posts activos (no expirados)
    const { count: activePosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .or(`is_permanent.eq.1,expires_at.gt.${new Date().toISOString()}`);

    res.json({
      totalPosts: totalPosts || 0,
      permanentPosts: permanentPosts || 0,
      totalUsers: totalUsers || 0,
      activePosts: activePosts || 0
    });
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}
