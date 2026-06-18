// src/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY is missing! Backend will run with Anon Key, which will cause RLS errors during database inserts.");
}

// Use service role key on the backend to bypass RLS
const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;