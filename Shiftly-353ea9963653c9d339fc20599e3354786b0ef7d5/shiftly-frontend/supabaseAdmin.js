// supabaseAdmin.js (do NOT use dotenv in Vite frontend)
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

export default supabaseAdmin;
