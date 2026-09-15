const Settings = require('../models/Settings');
const initialSettings = require('../config/settings');

// @desc    Get all settings
// @route   GET /api/settings
// @access  Public
exports.getSettings = async (req, res) => {
    try {
        const saved = await Settings.find().lean();
        const settings = initialSettings.map(definition => ({ ...definition, ...saved.find(setting => setting.key === definition.key) }));
        const settingsMap = Object.fromEntries(settings.map(setting => [setting.key, setting.value]));
        settingsMap.background_removal_available = Boolean(process.env.REMOVE_BG_API_KEY && process.env.REMOVE_BG_API_KEY !== 'YOUR_REMOVE_BG_API_KEY');

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

        if (!Array.isArray(updates) || !updates.length || updates.length > initialSettings.length) {
            return res.status(400).json({ success: false, error: 'Updates must be an array' });
        }

        const normalized = [];
        for (const update of updates) {
            const definition = initialSettings.find(setting => setting.key === update?.key);
            if (!definition) return res.status(400).json({ success: false, error: 'Unknown setting' });
            let value = update.value;
            if (definition.type === 'number') {
                if (value === '' || value === null || typeof value === 'boolean' || !Number.isFinite(Number(value)) || Number(value) < 0 || (definition.key === 'customization_discount' && Number(value) > 100)) {
                    return res.status(400).json({ success: false, error: `${definition.label} must be a valid non-negative number` });
                }
                value = Number(value);
            } else {
                if (typeof value !== 'string' || value.length > 5000) return res.status(400).json({ success: false, error: `${definition.label} must be text` });
                if (['enable_cod', 'promo_banner_show'].includes(definition.key) && !['true', 'false'].includes(value)) return res.status(400).json({ success: false, error: `${definition.label} must be true or false` });
                if (['url', 'image'].includes(definition.type) && value && value !== '#' && !/^https?:\/\//i.test(value)) return res.status(400).json({ success: false, error: `${definition.label} must be an HTTP or HTTPS URL` });
            }
            normalized.push({ definition, value });
        }
        const results = [];
        for (const { definition, value } of normalized) {
            const setting = await Settings.findOneAndUpdate(
                { key: definition.key },
                { $set: { ...definition, value } },
                { new: true, runValidators: true, upsert: true }
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


        // Only insert if empty or use upsert
        for (const s of initialSettings) {
            await Settings.findOneAndUpdate({ key: s.key }, { $setOnInsert: s }, { upsert: true, new: true });
        }

        res.status(200).json({ success: true, message: 'Settings seeded successfully' });
    } catch (error) {
        console.error('Seed settings error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
