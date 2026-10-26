const { requiredText, fail } = require('./checkout');
const effectivePrice = { $ifNull: ['$sellingPrice', '$price'] };
function catalogQuery(input) {
    const match = { isActive: true };
    const list = value => requiredText(value, 'Filter', 300).split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    for (const [key, field] of [['category', 'category'], ['type', 'productTypes'], ['catalog', 'catalogTypes']]) {
        if (input[key]) match[field] = { $in: list(input[key]) };
    }
    if (input.search) {
        const pattern = requiredText(input.search, 'Search', 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        match.$or = ['name', 'description', 'category', 'tags'].map(field => ({ [field]: { $regex: pattern, $options: 'i' } }));
    }
    const prices = [];
    for (const [field, operator] of [['minPrice', '$gte'], ['maxPrice', '$lte']]) {
        if (input[field] !== undefined) {
            const value = Number(requiredText(input[field], field, 30));
            if (!Number.isFinite(value) || value < 0) throw fail('Price filters must be non-negative numbers.');
            prices.push({ [operator]: [effectivePrice, value] });
        }
    }
    if (input.price === 'under-500') prices.push({ $lt: [effectivePrice, 500] });
    if (input.price === '500-1000') prices.push({ $gte: [effectivePrice, 500] }, { $lte: [effectivePrice, 1000] });
    if (input.price === 'over-1000') prices.push({ $gt: [effectivePrice, 1000] });
    if (prices.length) match.$expr = { $and: prices };
    const sort = input.sort === 'low' ? { catalogPrice: 1, _id: 1 }
        : input.sort === 'high' ? { catalogPrice: -1, _id: 1 }
        : input.sort === 'popular' ? { rating: -1, _id: 1 } : { createdAt: -1, _id: -1 };
    return { match, sort, page: Math.max(1, Math.min(100000, parseInt(input.page, 10) || 1)),
        limit: Math.max(1, Math.min(100, parseInt(input.limit, 10) || 12)) };
}
module.exports = { catalogQuery, effectivePrice };
