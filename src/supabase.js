import { createClient } from '@supabase/supabase-js';

// Se estiver rodando local, crie um arquivo .env.local com essas variáveis.
// No Vercel, configure nas Environment Variables do projeto.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);