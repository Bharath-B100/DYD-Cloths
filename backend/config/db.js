// config/db.js - Database connection configuration

const mongoose = require('mongoose');

const DB_STATE_NAMES = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
};

let lastConnectionError = null;
let retryTimer = null;
let retryDelay = 1000;
let connecting = null;
let stopped = false;
const stopRetry = () => { if (retryTimer) clearTimeout(retryTimer); retryTimer = null; };

const getDatabaseStatus = () => {
    const readyState = mongoose.connection.readyState;
    return {
        connected: readyState === 1,
        state: DB_STATE_NAMES[readyState] || 'unknown'
    };
};

const attemptConnection = async () => {
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
        retryDelay = 1000;
        stopRetry();

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);

        return conn;
    } catch (error) {
        lastConnectionError = error;
        console.error(`⚠️ MongoDB connection failed: ${error.message}`);
        // The API still starts so its health endpoint can report the outage,
        // but it does not claim that a database connection exists.
        if (!stopped && !retryTimer) {
            retryTimer = setTimeout(() => {
                retryTimer = null;
                connectDB();
            }, retryDelay);
            retryTimer.unref?.();
            retryDelay = Math.min(retryDelay * 2, 30000);
        }
        return null;
    }
};

const connectDB = () => {
    stopped = false;
    if (connecting) return connecting;
    stopRetry();
    connecting = attemptConnection().finally(() => { connecting = null; });
    return connecting;
};
connectDB.stopRetries = () => { stopped = true; stopRetry(); };
connectDB.getStatus = getDatabaseStatus;
connectDB.getLastError = () => lastConnectionError;

module.exports = connectDB;
