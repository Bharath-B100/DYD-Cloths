// config/db.js - Database connection configuration

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI =
            process.env.MONGODB_URI || 'mongodb://localhost:27017/tshirt-business';

        const conn = await mongoose.connect(mongoURI);

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);

        return conn;
    } catch (error) {
        console.error('⚠️ Falling back to local/cached data mode...');
        // Do not exit, allow server to run
    }
};

module.exports = connectDB;
