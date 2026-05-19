// scripts/clearData.js - Clear database collections
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const connectDB = require('../config/db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function clearDatabase() {
    try {
        console.log('🧹 Starting database clearing...');
        
        // Connect to database
        await connectDB();
        
        // Clear collections
        console.log('🧹 Clearing products...');
        await Product.deleteMany({});
        console.log('🧹 Clearing orders...');
        await Order.deleteMany({});
        
        // Note: We don't clear users because the admin needs to log in
        // but we can clear non-admin users if requested.
        // For now, let's keep the admin account.
        
        console.log('✅ Collections cleared!');
        console.log('🚀 Your shop is now empty and ready for new products via the Admin Portal.');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Clearing error:', error);
        process.exit(1);
    }
}

clearDatabase();
