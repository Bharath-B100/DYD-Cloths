function requireDisposableDatabase() {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DATABASE_RESET !== 'yes') {
        throw new Error('This command clears data. Use only a disposable development database with ALLOW_DATABASE_RESET=yes; production is blocked.');
    }
}
module.exports = { requireDisposableDatabase };
