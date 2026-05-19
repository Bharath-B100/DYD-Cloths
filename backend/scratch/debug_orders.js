const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars from backend directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const Order = require('../models/Order');
const User = require('../models/User');

async function debugOrders() {
    try {
        console.log('Using URI:', process.env.MONGODB_URI ? 'Atlas URI' : 'Local URI');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tshirt-business');
        console.log('Connected to MongoDB');

        const targetEmail = "23cb006@drngpit.ac.in";
        const targetUser = await User.findOne({ email: targetEmail });
        if (targetUser) {
            console.log(`\nFound User from Screenshot: ID: ${targetUser._id}, Email: "${targetUser.email}"`);
        } else {
            console.log(`\nUser with email "${targetEmail}" NOT FOUND in database!`);
        }

        const orders = await Order.find({});
        console.log('\n--- ORDERS ---');
        if (orders.length === 0) {
            console.log('No orders found in database.');
        } else {
            orders.forEach(o => {
                console.log(`Order: ${o.orderNumber}, Customer Email: "${o.customer.email}", UserID: ${o.user || 'NONE'}`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugOrders();
