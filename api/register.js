import { supabase } from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password requeridos' });
    }

    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    // Create user
    const { error } = await supabase
      .from('users')
      .insert([{ id, username, email: email || null, password: hashedPassword }]);

    if (error) throw error;

    const token = jwt.sign({ id, username }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ token, user: { id, username } });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}
