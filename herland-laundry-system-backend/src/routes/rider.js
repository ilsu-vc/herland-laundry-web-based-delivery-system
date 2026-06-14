const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyRole } = require('../middleware/auth');

/**
 * @route   GET /api/v1/rider/assigned-bookings
 * @desc    Get bookings explicitly assigned to the logged-in rider (Accepted)
 * @access  Rider
 */
router.get('/assigned-bookings', verifyRole('Rider'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('rider_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch profiles for customer names
        const userIds = [...new Set((data || []).map(b => b.user_id).filter(Boolean))];
        let profilesMap = {};

        if (userIds.length > 0) {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds);

            if (profileError) {
                console.error('Rider Fetch Profiles Error:', profileError.message);
            } else if (profiles) {
                profilesMap = Object.fromEntries(profiles.map(p => [p.id, { full_name: p.full_name }]));
            }
        }

        const mapped = (data || []).map(b => {
            const profile = profilesMap[b.user_id] || {};
            return {
                ...b,
                customerName: profile.full_name || 'Unknown Customer'
            };
        });

        res.json(mapped);
    } catch (error) {
        console.error('Rider Fetch Assigned Bookings Error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/v1/rider/completed-bookings
 * @desc    Get bookings explicitly assigned to the logged-in rider that are completed
 * @access  Rider
 */
router.get('/completed-bookings', verifyRole('Rider'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('rider_id', req.user.id)
            .in('status', ['Picked Up from Customer', 'Laundry Delivered', 'Picked Up', 'Delivered'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch profiles for customer names
        const userIds = [...new Set((data || []).map(b => b.user_id).filter(Boolean))];
        let profilesMap = {};

        if (userIds.length > 0) {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds);

            if (profileError) {
                console.error('Rider Fetch Profiles Error:', profileError.message);
            } else if (profiles) {
                profilesMap = Object.fromEntries(profiles.map(p => [p.id, { full_name: p.full_name }]));
            }
        }

        const mapped = (data || []).map(b => {
            const profile = profilesMap[b.user_id] || {};
            return {
                ...b,
                customerName: profile.full_name || 'Unknown Customer'
            };
        });

        res.json(mapped);
    } catch (error) {
        console.error('Rider Fetch Completed Bookings Error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * @route   GET /api/v1/rider/available-bookings
 * @desc    Get bookings waiting for a rider that haven't been declined by the user
 * @access  Rider
 */
router.get('/available-bookings', verifyRole('Rider'), async (req, res) => {
    try {
        // Fetch bookings dispatched for pickup OR out for delivery, with no rider assigned yet
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .or('status.eq.Booking Accepted,status.eq.Ready for Pick-up,status.eq.Rider Dispatched for Pickup,status.eq.Out for Delivery')
            .is('rider_id', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter out bookings declined by this rider
        const filtered = (data || []).filter(b => {
            if (!b.declined_by || !Array.isArray(b.declined_by)) return true;
            return !b.declined_by.includes(req.user.id);
        });

        // Fetch profiles for customer names
        const userIds = [...new Set(filtered.map(b => b.user_id).filter(Boolean))];
        let profilesMap = {};

        if (userIds.length > 0) {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds);

            if (profileError) {
                console.error('Rider Fetch Available Profiles Error:', profileError.message);
            } else if (profiles) {
                profilesMap = Object.fromEntries(profiles.map(p => [p.id, { full_name: p.full_name }]));
            }
        }

        const mapped = filtered.map(b => {
            const profile = profilesMap[b.user_id] || {};
            return {
                ...b,
                customerName: profile.full_name || 'Unknown Customer'
            };
        });

        res.json(mapped);
    } catch (error) {
        console.error('Rider Fetch Available Bookings Error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PATCH /api/v1/rider/accept/:id
 * @desc    Accept a booking assignment
 * @access  Rider
 */
router.patch('/accept/:id', verifyRole('Rider'), async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('bookings')
            .update({ rider_id: req.user.id })
            .eq('id', id)
            .is('rider_id', null)
            .select();

        if (error) throw error;
        if (data.length === 0) {
            return res.status(400).json({ error: 'Booking already assigned or not found' });
        }

        res.json({ message: 'Booking accepted successfully', booking: data[0] });
    } catch (error) {
        console.error('Rider Accept Error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PATCH /api/v1/rider/decline/:id
 * @desc    Decline a booking assignment
 * @access  Rider
 */
router.patch('/decline/:id', verifyRole('Rider'), async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch current declined_by array
        const { data: current, error: fetchError } = await supabase
            .from('bookings')
            .select('declined_by')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const declinedBy = Array.isArray(current.declined_by) ? current.declined_by : [];
        if (!declinedBy.includes(req.user.id)) {
            declinedBy.push(req.user.id);
        }

        const { data, error } = await supabase
            .from('bookings')
            .update({ declined_by: declinedBy })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({ message: 'Booking declined successfully' });
    } catch (error) {
        console.error('Rider Decline Error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PATCH /api/v1/rider/update-status/:id
 * @desc    Update booking status for delivery flow
 * @access  Rider
 */
router.patch('/update-status/:id', verifyRole('Rider'), async (req, res) => {
    const { id } = req.params;
    const { new_status, timeline } = req.body;

    // Riders typically handle these statuses
    const validRiderStatuses = ['Picked Up from Customer', 'Laundry Delivered'];

    if (!validRiderStatuses.includes(new_status)) {
        return res.status(400).json({ error: 'Invalid status update for Rider' });
    }

    try {
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: new_status, timeline: timeline })
            .eq('id', id)
            .select();

        if (error) throw error;

        if (data.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json({
            message: `Order status successfully updated to ${new_status}`,
            updatedBooking: data[0]
        });
    } catch (error) {
        console.error('Rider Status Update Error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
