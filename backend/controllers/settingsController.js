const Settings = require('../models/Settings');

// @desc    Get all settings
// @route   GET /api/settings
// @access  Public
exports.getSettings = async (req, res) => {
    try {
        const settings = await Settings.find();
        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });
        
        res.status(200).json({
            success: true,
            data: settingsMap,
            raw: settings // Helpful for admin panel
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Update settings (Multiple)
// @route   POST /api/settings
// @access  Private/Admin
exports.updateSettings = async (req, res) => {
    try {
        const updates = req.body; // Array of { key, value }
        
        if (!Array.isArray(updates)) {
            return res.status(400).json({ success: false, error: 'Updates must be an array' });
        }
        
        const results = [];
        for (const update of updates) {
            const setting = await Settings.findOneAndUpdate(
                { key: update.key },
                { value: update.value },
                { new: true, runValidators: true }
            );
            if (setting) results.push(setting);
        }
        
        res.status(200).json({
            success: true,
            message: `${results.length} settings updated`,
            data: results
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Seed initial settings
// @route   POST /api/settings/seed
// @access  Private/Admin (Should be restricted)
exports.seedSettings = async (req, res) => {
    try {
        const initialSettings = [
            // Branding & Shipping Strategy
            { key: 'site_name', value: 'DYD-Clothes', label: 'Site Name', category: 'branding', type: 'text' },
            { key: 'site_tagline', value: 'Design your Dream Clothes', label: 'Tagline', category: 'branding', type: 'text' },
            { key: 'shipping_fee', value: 99, label: 'Default Shipping Fee (₹)', category: 'branding', type: 'number' },
            { key: 'free_shipping_threshold', value: 499, label: 'Free Shipping Threshold (₹)', category: 'branding', type: 'number' },
            { key: 'enable_cod', value: 'true', label: 'Enable Cash on Delivery (true/false)', category: 'branding', type: 'text' },
            
            // Homepage Hero & Promo Banners
            { key: 'hero_title', value: 'Design Your <span class="text-gradient">Dream</span> Clothes', label: 'Hero Title', category: 'homepage', type: 'text' },
            { key: 'hero_subtitle', value: 'Premium quality custom t-shirts, hoodies and accessories designed by you, printed by us.', label: 'Hero Subtitle', category: 'homepage', type: 'textarea' },
            { key: 'hero_image', value: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', label: 'Hero Image URL', category: 'homepage', type: 'image' },
            { key: 'promo_banner_show', value: 'true', label: 'Show Promo Announcement Banner (true/false)', category: 'homepage', type: 'text' },
            { key: 'promo_banner_text', value: '🎉 Special Offer: Get FREE shipping on orders above ₹499! Use coupon FIRST10.', label: 'Announcement Banner Text', category: 'homepage', type: 'text' },
            { key: 'promo_banner_color', value: '#0f766e', label: 'Announcement Banner Color', category: 'homepage', type: 'color' },
            { key: 'customization_discount', value: 10, label: 'Start Designing Special Discount (%)', category: 'homepage', type: 'number' },
            
            // Contact
            { key: 'contact_phone', value: '+91 9943935576', label: 'Contact Phone', category: 'contact', type: 'text' },
            { key: 'contact_email', value: 'ngtbharath@gmail.com', label: 'Contact Email', category: 'contact', type: 'text' },
            { key: 'contact_address', value: 'Tirupur, coimbatore', label: 'Contact Address', category: 'contact', type: 'textarea' },
            
            // Social
            { key: 'social_whatsapp', value: '919943935576', label: 'WhatsApp Number', category: 'social', type: 'text' },
            { key: 'social_instagram', value: '#', label: 'Instagram URL', category: 'social', type: 'url' }
        ];

        // Only insert if empty or use upsert
        for (const s of initialSettings) {
            await Settings.findOneAndUpdate({ key: s.key }, s, { upsert: true, new: true });
        }

        res.status(200).json({ success: true, message: 'Settings seeded successfully' });
    } catch (error) {
        console.error('Seed settings error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
