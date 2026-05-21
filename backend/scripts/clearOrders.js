require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Order = require('../models/Order');

async function clearOrders() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        const result = await Order.deleteMany({});
        console.log(`✅ Deleted ${result.deletedCount} orders successfully.`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

clearOrders();
