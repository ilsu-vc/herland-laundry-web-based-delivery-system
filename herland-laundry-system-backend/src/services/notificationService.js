const nodemailer = require('nodemailer');
const supabase = require('../config/supabase');

// Configure Email Transporter
// NOTE: USER needs to provide SMTP credentials in .env
// Example: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
        user: process.env.SMTP_USER || 'mock_user',
        pass: process.env.SMTP_PASS || 'mock_pass',
    },
});

/**
 * Centralized Notification Service
 */
const notificationService = {
    /**
     * Send In-App Notification
     */
    async sendInApp(userId, message) {
        try {
            const { error } = await supabase
                .from('notifications')
                .insert([{ user_id: userId, message, is_read: false }]);
            if (error) throw error;
            console.log(`[In-App] Notification sent to ${userId}: ${message}`);
        } catch (err) {
            console.error('[In-App Error]', err.message);
        }
    },

    /**
     * Send Email Notification
     */
    async sendEmail(userId, subject, text) {
        try {
            // 1. Get user email from Supabase Auth (Service Role required)
            const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
            if (error || !user?.email) {
                console.warn(`[Email Skip] Could not find email for user ${userId}`);
                return;
            }

            // 2. Send via Nodemailer
            if (!process.env.SMTP_USER) {
                console.log(`[Email Mock] To: ${user.email} | Subject: ${subject} | Body: ${text}`);
                return;
            }

            await transporter.sendMail({
                from: '"Herland Laundry" <no-reply@herlandlaundry.com>',
                to: user.email,
                subject: subject,
                text: text,
            });
            console.log(`[Email Sent] To: ${user.email}`);
        } catch (err) {
            console.error('[Email Error]', err.message);
        }
    },

    /**
     * Send SMS Notification
     */
    async sendSMS(userId, message) {
        try {
            // 1. Get phone number from profile
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('phone_number')
                .eq('id', userId)
                .single();

            if (error || !profile?.phone_number) {
                console.warn(`[SMS Skip] No phone number for user ${userId}`);
                return;
            }

            // 2. Mock SMS Gateway (e.g., Twilio / Semaphore)
            console.log(`[SMS Mock] To: ${profile.phone_number} | Msg: ${message}`);
        } catch (err) {
            console.error('[SMS Error]', err.message);
        }
    },

    /**
     * Notify user on Booking Event
     */
    async notify(userId, eventType, bookingId, customMessage) {
        let message = '';
        let subject = '';

        switch (eventType) {
            case 'BOOKING_CREATED':
                subject = 'Booking Received - Herland Laundry';
                message = `Your booking #${bookingId} has been received and is pending approval.`;
                break;
            case 'BOOKING_ACCEPTED':
                subject = 'Booking Accepted - Herland Laundry';
                message = `Great news! Your booking #${bookingId} has been accepted.`;
                break;
            case 'WASHING':
                subject = 'Laundry in Progress';
                message = `Your laundry for booking #${bookingId} is now being processed (Washing/Drying).`;
                break;
            case 'READY':
                subject = 'Laundry Ready';
                message = `Your laundry for booking #${bookingId} is ready for pick-up/delivery.`;
                break;
            case 'DELIVERY':
                subject = 'Out for Delivery';
                message = `Your laundry for booking #${bookingId} is out for delivery!`;
                break;
            case 'COMPLETED':
                subject = 'Booking Completed';
                message = `Thank you for choosing Herland Laundry! Booking #${bookingId} is complete. You can now submit feedback in your bookings tab.`;
                break;
            case 'CANCELLED':
                subject = 'Booking Cancelled';
                message = `Your booking #${bookingId} has been successfully cancelled.`;
                break;
            case 'UPDATED':
                subject = 'Booking Updated';
                message = `Your booking #${bookingId} has been modified successfully.`;
                break;
            default:
                message = customMessage || `Update on your booking #${bookingId}`;
                subject = 'Booking Update - Herland Laundry';
        }

        // Trigger all channels
        await Promise.all([
            this.sendInApp(userId, message),
            this.sendEmail(userId, subject, message),
            this.sendSMS(userId, message)
        ]);
    }
};

module.exports = notificationService;
