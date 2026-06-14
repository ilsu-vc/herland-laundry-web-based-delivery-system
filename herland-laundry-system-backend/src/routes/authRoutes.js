// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Register
// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, phone, metadata } = req.body;
        
        // 1. Check if email already exists
        if (email && email.trim() !== '') {
            const { data: existingEmail } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .limit(1);
            
            if (existingEmail && existingEmail.length > 0) {
                return res.status(400).json({ error: 'This email address is linked to an existing account. Login or use a different email.' });
            }
        }

        // 2. Check if phone already exists
        if (phone) {
            let cleanPhone = phone.replace(/\D/g, '');
            let variants = [cleanPhone];
            if (cleanPhone.startsWith('09')) {
                variants.push(cleanPhone.substring(1));
                variants.push('63' + cleanPhone.substring(1));
                variants.push('+63' + cleanPhone.substring(1));
            } else if (cleanPhone.startsWith('9') && cleanPhone.length === 10) {
                variants.push('0' + cleanPhone);
                variants.push('63' + cleanPhone);
                variants.push('+63' + cleanPhone);
            } else if (cleanPhone.startsWith('63')) {
                variants.push('0' + cleanPhone.substring(2));
                variants.push(cleanPhone.substring(2));
                variants.push('+' + cleanPhone);
            }

            const { data: existingPhone } = await supabase
                .from('profiles')
                .select('id')
                .in('phone_number', variants)
                .limit(1);

            if (existingPhone && existingPhone.length > 0) {
                return res.status(400).json({ error: 'This phone number is linked to an existing account. Login or use a different number.' });
            }
        }
        
        // Prepare Supabase SignUp Options
        let signUpOptions = {
            password,
            options: {
                data: metadata,
            }
        };

        // If email is provided, use it
        if (email && email.trim() !== '') {
            signUpOptions.email = email;
            signUpOptions.options.emailRedirectTo = 'http://localhost:5173/login';
        } else if (phone) {
            // If no email, try phone. Supabase requires E.164 format (e.g., +639...)
            // Assuming input is 09xxxxxxxxx, convert to +639xxxxxxxxx
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.startsWith('09')) cleanPhone = '63' + cleanPhone.substring(1);
            else if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) cleanPhone = '63' + cleanPhone;
            signUpOptions.phone = '+' + cleanPhone;
        } else {
            return res.status(400).json({ error: 'Email or Phone Number is required.' });
        }

        const { data, error } = await supabase.auth.signUp(signUpOptions);

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
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
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
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
    const { email, phone } = req.body;
    try {
        if (email) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'http://localhost:5173/reset-password',
            });
            if (error) throw error;
            return res.status(200).json({ message: 'Password reset link sent to your email.' });
        } else if (phone) {
            // For phone, we send an OTP
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.startsWith('09')) cleanPhone = '63' + cleanPhone.substring(1);
            else if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) cleanPhone = '63' + cleanPhone;
            let formattedPhone = '+' + cleanPhone;
            
            const { error } = await supabase.auth.signInWithOtp({
                phone: formattedPhone,
            });
            if (error) throw error;
            return res.status(200).json({ message: 'OTP sent to your mobile number.' });
        } else {
            return res.status(400).json({ error: 'Email or phone number is required.' });
        }
    } catch (err) {
        console.error('Forgot Password Error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// Reset Password (assuming user is authenticated via link/otp)
router.post('/reset-password', async (req, res) => {
    const { password, access_token } = req.body;
    try {
        const { data, error } = await supabase.auth.updateUser({
            password: password
        }, {
            access_token: access_token
        });
        
        if (error) throw error;
        res.status(200).json({ message: 'Password updated successfully!' });
    } catch (err) {
        console.error('Reset Password Error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// Lookup email by phone number (used by frontend for phone login)
router.post('/lookup-email', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

        const cleanPhone = phone.replace(/\D/g, '');

        // Build all possible format variations of this phone number
        let variants = [cleanPhone]; // e.g. "09764705515"
        
        if (cleanPhone.startsWith('09')) {
            variants.push(cleanPhone.substring(1));            // "9764705515"
            variants.push('63' + cleanPhone.substring(1));     // "639764705515"
            variants.push('+63' + cleanPhone.substring(1));    // "+639764705515"
        } else if (cleanPhone.startsWith('9') && cleanPhone.length === 10) {
            variants.push('0' + cleanPhone);                   // "09764705515"
            variants.push('63' + cleanPhone);                  // "639764705515"
            variants.push('+63' + cleanPhone);                 // "+639764705515"
        } else if (cleanPhone.startsWith('63')) {
            variants.push('0' + cleanPhone.substring(2));      // "09764705515"
            variants.push(cleanPhone.substring(2));            // "9764705515"
            variants.push('+' + cleanPhone);                   // "+639764705515"
        }

        // --- Strategy 1: Search profiles table ---
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, email')
            .in('phone_number', variants)
            .maybeSingle();

        if (profile) {
            // If profiles already has email, return it immediately
            if (profile.email) {
                return res.status(200).json({ email: profile.email });
            }

            // Otherwise, get email from auth and backfill it into profiles
            const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.id);
            if (!authError && authUser?.user?.email) {
                // Backfill email into profiles for future direct lookups
                await supabase.from('profiles').update({ email: authUser.user.email }).eq('id', profile.id);
                return res.status(200).json({ email: authUser.user.email });
            }
        }

        // --- Strategy 2: Search auth.users (phone field + user_metadata.phone) ---
        // This catches accounts where phone_number was never saved to profiles
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });

        if (!listError && listData?.users) {
            for (const user of listData.users) {
                // Check the auth phone field (E.164 format like +639764705515)
                const authPhone = (user.phone || '').replace(/\D/g, '');
                // Check user_metadata.phone (could be 09764705515 format)
                const metaPhone = (user.user_metadata?.phone || '').replace(/\D/g, '');

                const authMatches = authPhone && variants.includes(authPhone);
                const metaMatches = metaPhone && variants.includes(metaPhone);

                if (authMatches || metaMatches) {
                    if (user.email) {
                        // Backfill email and phone into profiles for future direct lookups
                        const phoneToStore = metaPhone ? ('0' + (metaPhone.startsWith('63') ? metaPhone.substring(2) : metaPhone)) : cleanPhone;
                        await supabase.from('profiles').upsert(
                            { id: user.id, email: user.email, phone_number: phoneToStore },
                            { onConflict: 'id' }
                        );
                        return res.status(200).json({ email: user.email });
                    }
                }
            }
        }

        console.log('Phone lookup failed for all strategies. Tried variants:', variants);
        return res.status(404).json({ error: 'No account found with this mobile number.' });
    } catch (err) {
        console.error('Lookup Email Error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
