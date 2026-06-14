import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pipjndxdustaobgonnam.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcGpuZHhkdXN0YW9iZ29ubmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDE4NDAsImV4cCI6MjA4NTkxNzg0MH0.zK9H7_3T_2nJsTkCRKrJcB0zIu1QZ7Hvo96_gyP80nI';

// Custom storage adapter:
// - If the user checked "Keep me signed in", use localStorage (persists across browser restarts).
// - Otherwise, use sessionStorage (cleared when the tab is closed).
const hybridStorage = {
  getItem: (key) => {
    if (window.localStorage.getItem('keepSignedIn') === 'true') {
      return window.localStorage.getItem(key);
    }
    return window.sessionStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (window.localStorage.getItem('keepSignedIn') === 'true') {
      window.localStorage.setItem(key, value);
    }
    window.sessionStorage.setItem(key, value);
  },
  removeItem: (key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: hybridStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
});
