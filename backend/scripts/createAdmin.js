require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

async function createAdmin() {
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Store Administrator' } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) throw new Error('Provide ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters).');
    if (!await connectDB()) throw new Error('Database unavailable');
    const email = ADMIN_EMAIL.trim().toLowerCase();
    if (await User.exists({ email })) throw new Error('This account already exists. Manage its role through an existing administrator.');
    if (await User.countDocuments({ role: 'admin' }) >= 2) throw new Error('The configured limit of two administrators has been reached.');
    await User.create({ name: ADMIN_NAME, email, password: ADMIN_PASSWORD, passwordConfirm: ADMIN_PASSWORD, role: 'admin' });
    console.log('Administrator created. Existing customers, products and orders were retained.');
}

if (require.main === module) createAdmin().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
module.exports = createAdmin;
