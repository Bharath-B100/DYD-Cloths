const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageNumber = (value, fallback, max = 100000) => Math.min(max, Math.max(1, Number.parseInt(value, 10) || fallback));
const dateRange = (start, end) => {
    const range = {};
    for (const [key, value] of [['$gte', start], ['$lte', end]]) {
        if (!value) continue;
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) throw fail('Invalid date filter');
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) throw fail('Invalid date filter');
        if (key === '$lte' && value.length === 10) date.setUTCHours(23, 59, 59, 999);
        range[key] = date;
    }
    if (range.$gte && range.$lte && range.$gte > range.$lte) throw fail('Start date must be before end date');
    return Object.keys(range).length ? { createdAt: range } : {};
};
module.exports = { fail, escapeRegex, pageNumber, dateRange };
