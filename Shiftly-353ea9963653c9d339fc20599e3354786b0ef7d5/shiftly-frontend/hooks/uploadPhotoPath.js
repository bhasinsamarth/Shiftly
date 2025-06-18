// hooks/updatePhotoPath.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.admin.env.SUPABASE_URL,
  process.admin.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { userId, path } = req.body;

  const { error } = await supabase
    .from('employee')
    .update({ profile_photo_path: path })
    .eq('id', userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ message: 'Path updated successfully' });
}
