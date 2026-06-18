const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// ─── Table schema (from Supabase error details) ────────────────────────────────
// bookings: id, user_id, service_type (NOT NULL), status, schedule (timestamptz),
//           created_at, reference_number, stage (CHECK: received|payment|preparation|shipping|final|done),
//           timeline (jsonb), service_details (jsonb), collection_details (jsonb),
//           payment_details (jsonb), notes, collection_option

// ─── Public Services Route ───────────────────────────────────────────────────
router.get('/services', async (req, res) => {
    try {
        const { data: items, error: itemsError } = await supabase
            .from('service_items')
            .select('*')
            .order('sort_order', { ascending: true });

        if (itemsError) throw itemsError;

        const { data: scheduleRows, error: schedError } = await supabase
            .from('shop_schedule')
            .select('*')
            .limit(1);

        if (schedError) throw schedError;

        const services = (items || [])
            .filter(i => i.type === 'service' && !i.name.includes('"isLoad":true'))
            .map(i => ({
                id: i.id,
                name: i.name,
                currentPrice: Number(i.current_price),
                estimatedHours: i.estimated_hours != null ? Number(i.estimated_hours) : 0,
            }));

        const addOns = (items || [])
            .filter(i => i.type === 'addon')
            .map(i => ({
                id: i.id,
                name: i.name,
                currentPrice: Number(i.current_price),
                estimatedHours: i.estimated_hours != null ? Number(i.estimated_hours) : 0,
            }));

        let loadOptions = (items || [])
            .filter(i => i.name && i.name.includes('"isLoad":true'))
            .map(i => {
                try {
                    const parsed = JSON.parse(i.name);
                    return {
                        id: i.id,
                        label: parsed.label || '',
                        sublabel: parsed.sublabel || '',
                        description: parsed.description || '',
                        price: Number(i.current_price),
                        isEnabled: parsed.isEnabled !== false,
                    };
                } catch (e) {
                    return null;
                }
            })
            .filter(i => i !== null);

        // Deduplicate load options by label to handle any existing duplicate database rows
        const seenLabels = new Set();
        loadOptions = loadOptions.filter(opt => {
            if (seenLabels.has(opt.label)) return false;
            seenLabels.add(opt.label);
            return true;
        });

        const hasDbLoads = (items || []).some(i => i.name && i.name.includes('"isLoad":true'));
        if (!hasDbLoads) {
            // Auto-seed default loads into the DB so the frontend always gets real UUIDs
            const defaultLoads = [
                { label: 'Regular Light Mix', sublabel: 'Up to 7.5 kg', description: 'Shirts, Blouses/Polo, Pants, Socks, Underwear, etc.', isEnabled: true, isLoad: true },
                { label: 'Heavy Load', sublabel: 'Up to 5 kg', description: 'Beddings, Towels, Jeans, Fleece, Regular Jackets, etc.', isEnabled: true, isLoad: true },
                { label: 'Per Piece', sublabel: '₱220 per item', description: 'Comforter, Duvet, Pillow, etc.', isEnabled: true, isLoad: true },
            ];

            const insertRows = defaultLoads.map(load => ({
                type: 'service',
                name: JSON.stringify(load),
                current_price: 220,
                previous_price: null,
                estimated_hours: 0,
                sort_order: 99,
            }));

            const { data: seeded, error: seedError } = await supabase
                .from('service_items')
                .insert(insertRows)
                .select();

            if (!seedError && seeded) {
                loadOptions = seeded.map(i => {
                    const parsed = JSON.parse(i.name);
                    return {
                        id: i.id,
                        label: parsed.label || '',
                        sublabel: parsed.sublabel || '',
                        description: parsed.description || '',
                        price: Number(i.current_price),
                        isEnabled: parsed.isEnabled !== false,
                    };
                });
            }
        }

        let { data: faqs, error: faqsError } = await supabase
            .from('faqs')
            .select('*')
            .order('sort_order', { ascending: true });

        // If no FAQs, use fallback
        if (faqsError || !faqs || faqs.length === 0) {
            faqs = [
                { id: 'faq-1', question: 'What are your operating hours?', answer: 'We are open Monday to Saturday, from 8:00AM to 5:00PM. Bookings placed outside these hours will be processed the next business day.', sort_order: 1 },
                { id: 'faq-2', question: 'What types of services do you offer?', answer: 'We offer Wash, Dry, and Fold services.', sort_order: 2 },
                { id: 'faq-3', question: 'Do you offer pick up and delivery services?', answer: 'Yes! We provide convenient pick-up and delivery services. Just place a booking through our app.', sort_order: 3 },
                { id: 'faq-4', question: 'What payment methods are accepted?', answer: 'For drop-off bookings at our laundry shop, we accept cash or GCash. For online bookings, we accept GCash only.', sort_order: 4 },
                { id: 'faq-5', question: 'Do I need to register to book a service?', answer: 'Yes, registration is required to book a service.', sort_order: 5 },
                { id: 'faq-6', question: 'When will my laundry be ready?', answer: 'Bookings placed during operating hours are usually completed within the same day. Bookings placed after 5:00 PM will be processed the next business day.', sort_order: 6 },
                { id: 'faq-7', question: 'Can I change my account details?', answer: 'Yes! You can update your name, contact number, password, and saved address at any time in the Profile tab.', sort_order: 7 },
                { id: 'faq-8', question: 'I forgot my password, what should I do?', answer: "Tap 'Forgot Password' on the login screen. Enter your email or mobile number to receive a reset link or code, then follow the instructions to set a new password.", sort_order: 8 }
            ];
        }

        const formattedFaqs = faqs.map(f => ({
            id: f.id,
            question: f.question,
            answer: f.answer
        }));

        res.json({ services, addOns, loadOptions, schedule: scheduleRows?.[0] || null, faqs: formattedFaqs });
    } catch (error) {
        console.error('Fetch Services Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

// ─── Get Booked Slots ────────────────────────────────────────────────────────
router.get('/booked-slots', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('collection_details, collection_option')
            .neq('status', 'cancelled');

        if (error) throw error;

        // Separate counters for pickups and deliveries per slot
        const pickupCounts = {};    // key = date_time
        const deliveryCounts = {};  // key = date_time

        (data || []).forEach(b => {
            const cd = b.collection_details || {};
            const option = b.collection_option || 'dropOffPickUpLater';

            // COLLECTION slot: counts as a pickup if rider picks up,
            // otherwise it's a drop-off (customer comes in — not a delivery slot)
            if (cd.collectionDate && cd.collectionTime) {
                const key = `${cd.collectionDate}_${cd.collectionTime}`;
                if (option === 'pickedUpDelivered') {
                    // Rider picks up from customer
                    pickupCounts[key] = (pickupCounts[key] || 0) + 1;
                }
                // dropOffPickUpLater / dropOffDelivered: customer drops off, no rider pickup slot used
            }

            // DELIVERY slot: counts as a delivery if rider delivers back
            if (cd.deliveryDate && cd.deliveryTime) {
                const key = `${cd.deliveryDate}_${cd.deliveryTime}`;
                if (option === 'dropOffDelivered' || option === 'pickedUpDelivered') {
                    deliveryCounts[key] = (deliveryCounts[key] || 0) + 1;
                }
                // dropOffPickUpLater: customer picks up — no rider delivery slot used
            }
        });

        // Merge into one array per unique date+time, with separate counts
        const allKeys = new Set([
            ...Object.keys(pickupCounts),
            ...Object.keys(deliveryCounts),
        ]);

        const bookedSlots = Array.from(allKeys).map(key => {
            const [date, time] = key.split('_');
            return {
                date,
                time,
                pickup_count: pickupCounts[key] || 0,
                delivery_count: deliveryCounts[key] || 0,
                // legacy count field = max of both (used by calendar slot-full check)
                count: Math.max(pickupCounts[key] || 0, deliveryCounts[key] || 0),
            };
        });

        res.json(bookedSlots);
    } catch (error) {
        console.error('Fetch Booked Slots Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch booked slots' });
    }
});

// ─── Create a booking ──────────────────────────────────────────────────────────
router.post('/book', requireAuth, async (req, res) => {
    const {
        reference_number,
        collection_option,
        service_details,
        collection_details,
        payment_details,
        notes,
    } = req.body;

    if (!reference_number) {
        return res.status(400).json({ error: 'Missing reference number' });
    }

    try {
        // Fetch user role to verify they are a Customer
        const { data: profile, error: roleError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .single();

        if (roleError || !profile || (profile.role !== 'Customer' && profile.role !== 'Admin')) {
            return res.status(403).json({ error: 'Only customers can create bookings.' });
        }

        const nowIso = new Date().toISOString();

        // Build a human-readable service_type string
        const serviceNames =
            service_details?.selectedServices?.join(', ') || 'Laundry Service';

        // ─── Capacity Limit Check: 8 pickups + 8 deliveries per slot ────────────
        const collectionDate = collection_details?.collectionDate;
        const collectionTime = collection_details?.collectionTime;
        const deliveryDate   = collection_details?.deliveryDate;
        const deliveryTime   = collection_details?.deliveryTime;
        const option         = collection_option || 'dropOffPickUpLater';

        // Check pickup capacity (only for pickedUpDelivered)
        if (option === 'pickedUpDelivered' && collectionDate && collectionTime) {
            const { data: existingPickups, error: pickupCheckError } = await supabase
                .from('bookings')
                .select('id')
                .eq('collection_option', 'pickedUpDelivered')
                .eq('collection_details->>collectionDate', collectionDate)
                .eq('collection_details->>collectionTime', collectionTime)
                .neq('status', 'cancelled');

            if (!pickupCheckError && existingPickups && existingPickups.length >= 8) {
                return res.status(400).json({
                    error: 'The pickup slot is fully booked (max 8 pickups per slot). Please choose another time.'
                });
            }
        }

        // Check delivery capacity (for dropOffDelivered and pickedUpDelivered)
        if ((option === 'dropOffDelivered' || option === 'pickedUpDelivered') && deliveryDate && deliveryTime) {
            const { data: existingDeliveries, error: deliveryCheckError } = await supabase
                .from('bookings')
                .select('id')
                .in('collection_option', ['dropOffDelivered', 'pickedUpDelivered'])
                .eq('collection_details->>deliveryDate', deliveryDate)
                .eq('collection_details->>deliveryTime', deliveryTime)
                .neq('status', 'cancelled');

            if (!deliveryCheckError && existingDeliveries && existingDeliveries.length >= 8) {
                return res.status(400).json({
                    error: 'The delivery slot is fully booked (max 8 deliveries per slot). Please choose another time.'
                });
            }
        }
        // ────────────────────────────────────────────────────────────────────────

        let assignedRiderId = null;
        if (option === 'pickedUpDelivered' || option === 'dropOffDelivered') {
            const { data: riders } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', 'Rider');

            if (riders && riders.length > 0) {
                const randomIndex = Math.floor(Math.random() * riders.length);
                assignedRiderId = riders[randomIndex].id;
            }
        }

        const { data, error } = await supabase
            .from('bookings')
            .insert([
                {
                    user_id: req.user.id,
                    service_type: serviceNames,
                    status: 'pending',
                    schedule: nowIso,
                    reference_number,
                    stage: 'received',
                    collection_option: collection_option || 'dropOffPickUpLater',
                    timeline: [{ status: 'Booking Received', timestamp: nowIso }],
                    service_details: service_details || null,
                    collection_details: collection_details || null,
                    payment_details: payment_details || null,
                    notes: notes || '',
                    rider_id: assignedRiderId,
                },
            ])
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', JSON.stringify(error, null, 2));
            return res.status(500).json({ error: 'Failed to create booking. ' + error.message });
        }

        res.status(201).json({
            message: 'Booking created successfully!',
            booking: data,
        });

        // Send Notification
        notificationService.notify(req.user.id, 'BOOKING_CREATED', data.reference_number || data.id);

        // Notify auto-assigned rider
        if (assignedRiderId) {
            notificationService.notify(assignedRiderId, 'CUSTOM', data.reference_number || data.id, 'A new booking has been auto-assigned to you.');
        }
    } catch (error) {
        console.error('Error creating booking:', error.message || error);
        res.status(500).json({ error: 'Failed to create booking. Please try again.' });
    }
});

// ─── Helper: normalize a DB row into the frontend shape ─────────────────────────
function normalizeBooking(b) {
    return {
        id: b.reference_number || b.id,
        dbId: b.id,
        userId: b.user_id,
        customerName: b.service_type || 'Laundry Service',
        date: b.created_at
            ? new Date(b.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
              })
            : '-',
        collectionOption: b.collection_option || 'dropOffPickUpLater',
        stage: b.stage || 'received',
        timeline: b.timeline || [
            { status: 'Booking Received', timestamp: b.created_at || new Date().toISOString() },
        ],
        serviceDetails: b.service_details || null,
        collectionDetails: b.collection_details || null,
        paymentDetails: b.payment_details || null,
        status: b.status || 'pending',
        notes: b.notes || '',
        created_at: b.created_at || null,
        rider_id: b.rider_id || null,
    };
}

// ─── Get my bookings ────────────────────────────────────────────────────────────
router.get('/my-bookings', requireAuth, async (req, res) => {
    try {
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (bookings || []).map(normalizeBooking);
        res.json(mapped);
    } catch (error) {
        console.error('Fetch My Bookings Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// ─── Helper: find a booking by reference_number or ID ──────────────────────────
async function getBookingByIdOrRef(id, userId, hasBypass = false) {
    // 1. Check if it's a numeric ID
    const isNumeric = /^\d+$/.test(id);
    
    let query = supabase.from('bookings').select('*');
    
    // 2. Build OR filter
    if (isNumeric) {
        query = query.or(`reference_number.eq.${id},id.eq.${id}`);
    } else {
        query = query.eq('reference_number', id);
    }

    // 3. Ownership check if not bypassed
    if (!hasBypass) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) console.error('[DEBUG] getBookingByIdOrRef error:', error);
    return data;
}

// ─── Get a single booking ──────────────────────────────────────────────────────
router.get('/my-bookings/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    console.log(`[DEBUG] Fetching booking: ${id} for user: ${req.user.id}`);

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .maybeSingle();

        const hasBypass = profile?.role === 'Admin' || profile?.role === 'Staff';
        let booking = null;

        if (hasBypass || profile?.role === 'Rider') {
            // For riders, we check if they are the assigned rider later
            booking = await getBookingByIdOrRef(id, req.user.id, true);
            
            if (booking && profile?.role === 'Rider' && booking.rider_id !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized to view this booking' });
            }
        } else {
            booking = await getBookingByIdOrRef(id, req.user.id, false);
        }

        if (!booking) {
            console.log(`[DEBUG] Booking ${id} not found or unauthorized for user ${req.user.id}`);
            return res.status(404).json({ error: 'Booking not found' });
        }

        const { data: customerFeedback } = await supabase.from('customer_feedback').select('*').eq('booking_id', booking.id).maybeSingle();
        const { data: riderFeedback } = await supabase.from('rider_feedback').select('*').eq('booking_id', booking.id).maybeSingle();

        const responseData = normalizeBooking(booking);
        responseData.customer_feedback = customerFeedback || null;
        responseData.rider_feedback = riderFeedback || null;

        res.json(responseData);
    } catch (error) {
        console.error('Fetch Single Booking Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch booking' });
    }
});

// ─── Update payment reference ──────────────────────────────────────────────────
router.post('/my-bookings/:id/payment-reference', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { referenceNumber } = req.body;

    if (!referenceNumber) {
        return res.status(400).json({ error: 'Reference number is required' });
    }

    try {
        const booking = await getBookingByIdOrRef(id, req.user.id);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const currentPayment = booking.payment_details || {};
        const updatedPayment = {
            ...currentPayment,
            referenceNumber: referenceNumber,
        };

        const { error: updateError } = await supabase
            .from('bookings')
            .update({ payment_details: updatedPayment })
            .eq('id', booking.id);

        if (updateError) throw updateError;

        res.json({ message: 'Payment reference updated successfully' });
    } catch (error) {
        console.error('Update Payment Reference Error:', error.message);
        res.status(500).json({ error: 'Failed to update payment reference' });
    }
});

// ─── Profile Management ────────────────────────────────────────────────────────
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', req.user.id)
            .maybeSingle();

        if (error) throw error;

        let displayPhone = req.user.phone || profile?.phone_number || '';
        if (displayPhone) {
            let clean = displayPhone.replace(/\D/g, '');
            if (clean.startsWith('63')) clean = '0' + clean.substring(2);
            else if (clean.length === 10 && clean.startsWith('9')) clean = '0' + clean;
            displayPhone = clean;
        }

        res.json({
            id: req.user.id,
            email: req.user.email,
            phone: displayPhone, // Auth phone
            full_name: profile?.full_name || '',
            profile_phone: displayPhone, // Profile table phone
            role: profile?.role || 'Customer',
            avatar_url: profile?.avatar_url || null,
            address: profile?.address || '',
            lat: profile?.lat || null,
            lng: profile?.lng || null
        });
    } catch (error) {
        console.error('Fetch Profile Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

router.put('/profile', requireAuth, async (req, res) => {
    const { name, phone, password, address, lat, lng } = req.body;

    try {
        // 1. Update Profile table
        const profileUpdate = {};
        if (name !== undefined) profileUpdate.full_name = name;
        if (phone !== undefined) profileUpdate.phone_number = phone;
        if (req.body.avatar_url !== undefined) profileUpdate.avatar_url = req.body.avatar_url;
        if (address !== undefined) profileUpdate.address = address;
        if (lat !== undefined) profileUpdate.lat = lat;
        if (lng !== undefined) profileUpdate.lng = lng;

        if (Object.keys(profileUpdate).length > 0) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update(profileUpdate)
                .eq('id', req.user.id);

            if (profileError) throw profileError;
        }

        // 2. Update Auth (Password/Phone if needed)
        const authUpdate = {};
        if (password) authUpdate.password = password;
        
        // If updating phone in auth, convert to E.164
        if (phone) {
            let cleanPhone = String(phone).replace(/\D/g, '');
            if (cleanPhone.startsWith('09')) cleanPhone = '63' + cleanPhone.substring(1);
            else if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) cleanPhone = '63' + cleanPhone;
            
            if (cleanPhone.startsWith('63')) {
                authUpdate.phone = '+' + cleanPhone;
            }
        }

        if (Object.keys(authUpdate).length > 0) {
            const { error: authError } = await supabase.auth.updateUser(authUpdate);
            if (authError) {
                console.warn('Auth update warning:', authError.message);
                if (password) throw authError;
            }
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update Profile Error:', error.message);
        res.status(500).json({ error: `Failed to update profile: ${error.message}` });
    }
});

// ─── Cancel a booking ─────────────────────────────────────────────────────────
router.patch('/my-bookings/:id/cancel', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const booking = await getBookingByIdOrRef(id, req.user.id);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending bookings can be cancelled.' });
        }

        const nowIso = new Date().toISOString();
        const updatedTimeline = [
            ...(booking.timeline || []),
            { status: 'Booking Cancelled', timestamp: nowIso }
        ];

        const { error: updateError } = await supabase
            .from('bookings')
            .update({ 
                status: 'cancelled',
                timeline: updatedTimeline
            })
            .eq('id', booking.id);

        if (updateError) throw updateError;

        res.json({ message: 'Booking cancelled successfully' });

        // Send Notification
        notificationService.notify(req.user.id, 'CANCELLED', booking.reference_number || booking.id);
    } catch (error) {
        console.error('Cancel Booking Error:', error.message);
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
});

// ─── Update a booking ──────────────────────────────────────────────────────────
router.patch('/my-bookings/:id/update', requireAuth, async (req, res) => {
    const { id } = req.params;
    const {
        service_details,
        collection_details,
        payment_details,
        notes,
        collection_option
    } = req.body;

    try {
        const booking = await getBookingByIdOrRef(id, req.user.id);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending bookings can be modified.' });
        }

        // ─── 15-minute edit window enforcement ──────────────────────────────
        const EDIT_WINDOW_MS = 15 * 60 * 1000;
        const createdAt = new Date(booking.created_at).getTime();
        if (Date.now() - createdAt > EDIT_WINDOW_MS) {
            return res.status(403).json({
                error: 'The 15-minute editing window has expired. This booking can no longer be modified.'
            });
        }
        // ────────────────────────────────────────────────────────────────────

        // ─── Edit limit enforcement (max 2 edits) ──────────────────────────
        const editCount = (booking.timeline || []).filter(item => item.status === 'Booking Edited').length;
        if (editCount >= 2) {
            return res.status(403).json({
                error: 'You have reached the maximum allowed edits (2) for this booking.'
            });
        }
        // ────────────────────────────────────────────────────────────────────

        const nowIso = new Date().toISOString();
        const updatedTimeline = [
            ...(booking.timeline || []),
            { status: 'Booking Edited', timestamp: nowIso }
        ];

        // ─── Capacity Limit Check: 8 pickups + 8 deliveries per slot ────────────
        const collectionDate = collection_details?.collectionDate || booking.collection_details?.collectionDate;
        const collectionTime = collection_details?.collectionTime || booking.collection_details?.collectionTime;
        const deliveryDate   = collection_details?.deliveryDate   || booking.collection_details?.deliveryDate;
        const deliveryTime   = collection_details?.deliveryTime   || booking.collection_details?.deliveryTime;
        const option         = collection_option || booking.collection_option || 'dropOffPickUpLater';

        // Check pickup capacity (only for pickedUpDelivered)
        if (option === 'pickedUpDelivered' && collectionDate && collectionTime) {
            const { data: existingPickups, error: pickupCheckError } = await supabase
                .from('bookings')
                .select('id')
                .eq('collection_option', 'pickedUpDelivered')
                .eq('collection_details->>collectionDate', collectionDate)
                .eq('collection_details->>collectionTime', collectionTime)
                .neq('status', 'cancelled')
                .neq('id', booking.id);

            if (!pickupCheckError && existingPickups && existingPickups.length >= 8) {
                return res.status(400).json({
                    error: 'The pickup slot is fully booked (max 8 pickups per slot). Please choose another time.'
                });
            }
        }

        // Check delivery capacity (for dropOffDelivered and pickedUpDelivered)
        if ((option === 'dropOffDelivered' || option === 'pickedUpDelivered') && deliveryDate && deliveryTime) {
            const { data: existingDeliveries, error: deliveryCheckError } = await supabase
                .from('bookings')
                .select('id')
                .in('collection_option', ['dropOffDelivered', 'pickedUpDelivered'])
                .eq('collection_details->>deliveryDate', deliveryDate)
                .eq('collection_details->>deliveryTime', deliveryTime)
                .neq('status', 'cancelled')
                .neq('id', booking.id);

            if (!deliveryCheckError && existingDeliveries && existingDeliveries.length >= 8) {
                return res.status(400).json({
                    error: 'The delivery slot is fully booked (max 8 deliveries per slot). Please choose another time.'
                });
            }
        }
        // ────────────────────────────────────────────────────────────────────────

        // Re-calculate service_type string
        const serviceNames = service_details?.selectedServices?.join(', ') || booking.service_type;

        const updatePayload = {
            timeline: updatedTimeline,
            service_type: serviceNames
        };

        if (service_details) updatePayload.service_details = service_details;
        if (collection_details) updatePayload.collection_details = collection_details;
        if (payment_details) updatePayload.payment_details = payment_details;
        if (notes !== undefined) updatePayload.notes = notes;
        if (collection_option) updatePayload.collection_option = collection_option;

        const { error: updateError } = await supabase
            .from('bookings')
            .update(updatePayload)
            .eq('id', booking.id);

        if (updateError) throw updateError;

        res.json({ message: 'Booking updated successfully' });

        // Send Notification
        notificationService.notify(req.user.id, 'UPDATED', booking.reference_number || booking.id);
    } catch (error) {
        console.error('Update Booking Error:', error.message);
        res.status(500).json({ error: 'Failed to update booking' });
    }
});

// ─── Submit Feedback ──────────────────────────────────────────────────────────
router.patch('/my-bookings/:id/feedback', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { customer_feedback, rider_feedback } = req.body;

    if (!customer_feedback || !customer_feedback.rating || customer_feedback.rating < 1 || customer_feedback.rating > 5) {
        return res.status(400).json({ error: 'Valid laundry rating (1-5) is required' });
    }

    if (!rider_feedback || !rider_feedback.rating || rider_feedback.rating < 1 || rider_feedback.rating > 5) {
        return res.status(400).json({ error: 'Valid rider rating (1-5) is required' });
    }

    try {
        // Verify booking belongs to user and is completed
        const booking = await getBookingByIdOrRef(id, req.user.id);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const terminalStatuses = ['delivered', 'completed', 'booking completed'];
        if (!terminalStatuses.includes((booking.status || '').toLowerCase())) {
            return res.status(400).json({ error: 'Feedback can only be provided for completed bookings' });
        }

        // Check if feedback already exists to prevent duplicate
        const { data: existingCustomerFeedback } = await supabase.from('customer_feedback').select('id').eq('booking_id', booking.id).maybeSingle();
        if (existingCustomerFeedback) {
             return res.status(400).json({ error: 'Feedback has already been submitted for this booking.' });
        }

        // Insert into customer_feedback
        const customerFeedbackPayload = {
            booking_id: booking.id,
            user_id: req.user.id,
            rating: customer_feedback.rating,
            review_tags: customer_feedback.review_tags || [],
            review_comment: customer_feedback.review_comment || null,
        };

        const { error: cfError } = await supabase.from('customer_feedback').insert([customerFeedbackPayload]);
        if (cfError) throw cfError;

        // Insert into rider_feedback
        const riderId = booking.rider_id || rider_feedback.rider_id;
        if (riderId) {
            const riderFeedbackPayload = {
                booking_id: booking.id,
                rider_id: riderId,
                rating: rider_feedback.rating,
                review_tags: rider_feedback.review_tags || []
            };

            const { error: rfError } = await supabase.from('rider_feedback').insert([riderFeedbackPayload]);
            if (rfError) throw rfError;
        }

        res.json({ message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Submit Feedback Error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

