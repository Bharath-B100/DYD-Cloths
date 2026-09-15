// config/db.js - Database connection configuration

const mongoose = require('mongoose');

const DB_STATE_NAMES = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
};

let lastConnectionError = null;

const getDatabaseStatus = () => {
    const readyState = mongoose.connection.readyState;
    return {
        connected: readyState === 1,
        state: DB_STATE_NAMES[readyState] || 'unknown'
    };
};

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    try {
        const mongoURI =
            process.env.MONGODB_URI || 'mongodb://localhost:27017/tshirt-business';

        const timeoutFromEnv = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS);
        const conn = await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: Number.isFinite(timeoutFromEnv) && timeoutFromEnv > 0
                ? timeoutFromEnv
                : 10000
        });

        lastConnectionError = null;

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);

        return conn;
    } catch (error) {
        lastConnectionError = error;
        console.error(`⚠️ MongoDB connection failed: ${error.message}`);
        // The API still starts so its health endpoint can report the outage,
        // but it does not claim that a database connection exists.
        return null;
    }
};

connectDB.getStatus = getDatabaseStatus;
connectDB.getLastError = () => lastConnectionError;

module.exports = connectDB;
