const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows your Frontend to talk to this Backend
app.use(express.json());

// Default Route
app.get('/', (req, res) => {
    res.send('Welcome to Herland Laundry System API');
});

// Health Check (used by Docker HEALTHCHECK)
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Middleware Imports
const { requireAuth } = require('./middleware/auth');

// Supabase Initialization --> THE LINK is in .env

const supabase = require('./config/supabase');

// Import Modular Routes (Domain Isolation)
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/admin');
const staffRoutes = require('./routes/staff');
const customerRoutes = require('./routes/customer');
const riderRoutes = require('./routes/rider');

// Mount Admin Routes
app.use('/api/v1/admin', adminRoutes);

// Mount Rider Routes
app.use('/api/v1/rider', riderRoutes);

// Mount Customer Routes
app.use('/api/v1/customer', customerRoutes);

// Mount Auth Routes
app.use('/api/v1/auth', authRoutes);

// --- Existing API Endpoints (Preserved) ---

// 1. Register
app.post('/api/v1/auth/register', async (req, res) => {
    const { email, phone, password, metadata } = req.body;

    // Convert phone to E.164 format for Supabase auth
    let e164Phone = phone;
    if (e164Phone && e164Phone.startsWith('0')) {
        e164Phone = '+63' + e164Phone.substring(1);
    }

    const { data, error } = await supabase.auth.signUp({
        email: email || undefined,
        phone: (e164Phone && e164Phone.startsWith('+')) ? e164Phone : undefined,
        password,
        options: { data: metadata }
    });
    if (error) return res.status(400).json({ error: error.message });

    // Save phone number, full name, and email to the profiles table
    const userId = data.user?.id;
    if (userId) {
        const profileUpdate = {};
        if (metadata?.phone) profileUpdate.phone_number = metadata.phone;
        if (metadata?.full_name) profileUpdate.full_name = metadata.full_name;
        if (email) profileUpdate.email = email;

        if (Object.keys(profileUpdate).length > 0) {
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({ id: userId, ...profileUpdate }, { onConflict: 'id' });

            if (profileError) {
                console.error('Profile update error:', profileError.message);
            }
        }
    }

    res.status(201).json({ message: 'User registered successfully', data });
});

// 2. Login
app.post('/api/v1/auth/login', async (req, res) => {
    const { email, phone, password } = req.body;
    let signInOptions = { password };
    
    if (email) {
        signInOptions.email = email;
    } else if (phone) {
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('09')) cleanPhone = '63' + cleanPhone.substring(1);
        else if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) cleanPhone = '63' + cleanPhone;
        signInOptions.phone = '+' + cleanPhone;
    } else {
        return res.status(400).json({ error: 'Email or Phone Number is required.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword(signInOptions);
    if (error) return res.status(401).json({ error: error.message });
    res.status(200).json({ token: data.session.access_token, user: data.user });
});

// 3. Booking
app.post('/api/v1/bookings', requireAuth, async (req, res) => {
    const { userId, serviceType, schedule } = req.body;

    // ─── Operational Hours Enforcement & 4-Hour Rule ─────────
    const { getHours, addDays, setHours, setMinutes, setSeconds } = require('date-fns');

    // Parse the requested date and hour from schedule
    const reqDate = new Date(schedule);
    const reqHour = getHours(reqDate);

    // Reject if outside operational hours (08:00 to 18:00)
    if (reqHour < 8 || reqHour >= 18) {
        return res.status(400).json({ error: 'Requested schedule is outside operational hours (08:00 to 18:00)' });
    }

    // Default expected completion is +4 hours
    let expectedCompletion = new Date(reqDate);
    expectedCompletion = setHours(expectedCompletion, reqHour + 4);

    // If difference < 4 hours from closing time (18:00)
    if (18 - reqHour < 4) {
        // Adjust expected completion to next day at 08:00
        expectedCompletion = addDays(new Date(reqDate), 1);
        expectedCompletion = setHours(expectedCompletion, 8);
        expectedCompletion = setMinutes(expectedCompletion, 0);
        expectedCompletion = setSeconds(expectedCompletion, 0);
    }
    // ────────────────────────────────────────────────────────

    // ─── Double Booking Prevention (Capacity Bug Fix) ─────────
    if (schedule) {
        const { count, error: checkError } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('schedule', schedule)
            .neq('status', 'cancelled');

        if (checkError) {
            console.error('Check docuble booking error:', checkError);
        }

        if (count >= 8) {
            return res.status(400).json({
                error: 'This time slot is fully booked (Max 8 customers). Please choose another time.'
            });
        }
    }
    // ────────────────────────────────────────────────────────────────────────────

    // Also extract new schema fields
    const { delivery_method, total_weight, downpayment_status } = req.body;

    const { data, error } = await supabase
        .from('bookings')
        .insert([{
            user_id: userId,
            service_type: serviceType,
            status: 'pending',
            schedule,
            delivery_method,
            total_weight,
            downpayment_status,
            expected_completion: expectedCompletion.toISOString()
        }])
        .select();

    if (error) return res.status(500).json({ error: error.message });

    // Logic for Notification Bin
    await supabase.from('notifications').insert([{ 
        user_id: userId, 
        title: 'Booking Confirmed', 
        message: `New booking for ${serviceType} confirmed!` 
    }]);

    res.status(201).json(data);
});

// 4. Notifications Fetch
app.get('/api/v1/notifications', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(data);
});

// 5. Mark Notification Read
app.patch('/api/v1/notifications/:id/read', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ success: true });
});

// 6. Mark All Notifications Read
app.patch('/api/v1/notifications/read-all', requireAuth, async (req, res) => {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', req.user.id)
        .eq('is_read', false);
    if (error) {
        console.error("READ-ALL ERROR:", error);
        return res.status(500).json({ error: error.message });
    }
    res.status(200).json({ success: true });
});

// 7. Delete Notification
app.delete('/api/v1/notifications/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Herland Backend running on http://localhost:${PORT}`));

async function testConnection() {
    console.log("🔍 Checking Supabase connection...");
    // Use 'profiles' or another small table to test connection. 
    // If 'profiles' doesn't exist, this might fail, but connection itself is tested.
    const { data, error } = await supabase.from('profiles').select('*').limit(1);

    if (error) {
        console.error("❌ Connection Failed:", error.message);
    } else {
        console.log("✅ Connection Successful! Database is talking to the Backend.");
    }
}

testConnection();

// --- Anti-Sleep Workaround ---
// Ping the health endpoint every 14 minutes (840,000 ms) to prevent Render from putting the free instance to sleep.
const RENDER_URL = 'https://laundry-booking-5gb4.onrender.com';
setInterval(() => {
    fetch(`${RENDER_URL}/api/v1/health`)
        .then(res => {
            console.log(`[Anti-Sleep] Pinged self successfully at ${new Date().toISOString()}`);
        })
        .catch(err => {
            console.error(`[Anti-Sleep] Ping failed:`, err.message);
        });
}, 14 * 60 * 1000);