import { createClient } from '@supabase/supabase-js'

// Replace with your Supabase URL and anon key
const supabaseUrl = 'https://mryfanarpbnauvrhzhgq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeWZhbmFycGJuYXV2cmh6aGdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzMTU0NDUsImV4cCI6MjA1OTg5MTQ0NX0.lb-1M1kHxLFNwgL-hp2y7cGIE0fC5VgH3TMNA9Hb3-U'

export const supabase = createClient(supabaseUrl, supabaseAnonKey) 