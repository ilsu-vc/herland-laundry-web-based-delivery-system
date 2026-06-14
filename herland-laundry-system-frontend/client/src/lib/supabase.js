import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pipjndxdustaobgonnam.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcGpuZHhkdXN0YW9iZ29ubmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDE4NDAsImV4cCI6MjA4NTkxNzg0MH0.zK9H7_3T_2nJsTkCRKrJcB0zIu1QZ7Hvo96_gyP80nI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use sessionStorage so the login session is cleared when the tab/browser is closed.
    // Users must explicitly log in each time they visit.
    storage: window.sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
});
