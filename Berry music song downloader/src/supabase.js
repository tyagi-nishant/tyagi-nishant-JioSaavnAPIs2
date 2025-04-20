import { createClient } from '@supabase/supabase-js'

// Log the environment variables to verify they are loaded
// console.log("Supabase Init: VITE_SUPABASE_URL =", import.meta.env.VITE_SUPABASE_URL);
// console.log("Supabase Init: VITE_SUPABASE_ANON_KEY =", import.meta.env.VITE_SUPABASE_ANON_KEY ? '*** Loaded ***' : '!!! NOT LOADED !!!');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if the variables are actually defined
if (!supabaseUrl) {
  console.error("Error: VITE_SUPABASE_URL is not defined in .env file");
  // Optionally throw an error or handle this case appropriately
  // throw new Error("Supabase environment variables are not configured.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey,
    {
        auth: {
          persistSession: true,  // Ensures session is stored in localStorage
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }
      }
    ); 