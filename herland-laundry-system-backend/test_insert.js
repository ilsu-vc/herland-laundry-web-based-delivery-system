const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Testing insert...");
    const { data, error } = await supabase
        .from('service_items')
        .insert({
            type: 'load',
            name: JSON.stringify({ label: 'Test Load', sublabel: 'Test', description: 'Test', isEnabled: false }),
            current_price: 220,
            sort_order: 99
        })
        .select()
        .single();
    
    console.log("Data:", data);
    console.log("Error:", error);
}
run();
