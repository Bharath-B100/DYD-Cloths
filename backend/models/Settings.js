const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    label: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['general', 'homepage', 'contact', 'social', 'branding', 'pricing']
    },
    type: {
        type: String,
        required: true,
        enum: ['text', 'textarea', 'image', 'number', 'color', 'url']
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
