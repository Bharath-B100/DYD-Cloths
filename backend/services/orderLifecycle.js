const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { fail, isProductId } = require('./checkout');

const transitions = {
    pending: ['confirmed', 'processing', 'cancelled'],
    confirmed: ['processing', 'shipped', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'], delivered: [], cancelled: []
};

function inventoryItems(items) {
    const amounts = new Map();
    for (const item of items) {
        if (isProductId(item.productId)) {
            const id = item.productId.toLowerCase();
            amounts.set(id, (amounts.get(id) || 0) + item.quantity);
        }
    }
    return [...amounts].map(([productId, quantity]) => ({ productId, quantity }));
}

async function reserveInventory(order) {
    for (const { productId, quantity } of inventoryItems(order.items)) {
        const product = await Product.findOneAndUpdate({
            _id: productId, isActive: true, stock: { $gte: quantity },
            'stockReservations.orderId': { $ne: order._id }
        }, {
            $inc: { stock: -quantity },
            $push: { stockReservations: { orderId: order._id, quantity } }
        }, { new: true });
        if (!product) throw fail('An item just sold out or changed availability. Please refresh your cart.', 409);
    }
}

async function releaseInventory(order) {
    for (const { productId, quantity } of inventoryItems(order.items)) {
        if (order.inventoryManaged) {
            // The reservation predicate and stock increment happen in one document write.
            // Repeated cancellation/cleanup therefore cannot increment stock twice.
            await Product.updateOne({ _id: productId, 'stockReservations.orderId': order._id }, {
                $inc: { stock: quantity }, $pull: { stockReservations: { orderId: order._id } }
            });
        } else {
            await Product.updateOne({ _id: productId }, { $inc: { stock: quantity } });
        }
    }
}

async function reserveCoupon(order, coupon) {
    if (!coupon) return;
    const filter = { _id: coupon._id, isActive: true, startDate: { $lte: new Date() }, endDate: { $gte: new Date() },
        'redemptions.orderId': { $ne: order._id } };
    if (coupon.usageLimit != null) filter.usedCount = { $lt: coupon.usageLimit };
    if (coupon.perUserLimit != null && order.user) {
        // Include historical orders created before reservation accounting was introduced.
        const historical = await Order.countDocuments({ user: order.user, couponCode: coupon.code,
            couponReservationManaged: { $ne: true }, status: { $ne: 'cancelled' } });
        const remaining = coupon.perUserLimit - historical;
        if (remaining <= 0) throw fail('You have reached the usage limit for this coupon.');
        filter.$expr = { $lt: [{ $size: { $filter: { input: { $ifNull: ['$redemptions', []] },
            as: 'entry', cond: { $eq: ['$$entry.userId', order.user] } } } }, remaining] };
    }
    const reserved = await Coupon.findOneAndUpdate(filter, {
        $inc: { usedCount: 1 }, $push: { redemptions: { orderId: order._id, userId: order.user } }
    }, { new: true });
    if (!reserved) throw fail('This coupon has reached its usage limit or is no longer available.', 409);
}

async function releaseCoupon(order) {
    if (!order.couponCode || !order.couponReservationManaged) return;
    await Coupon.updateOne({ code: order.couponCode, 'redemptions.orderId': order._id }, {
        $inc: { usedCount: -1 }, $pull: { redemptions: { orderId: order._id } }
    });
}

async function transitionOrder(orderId, nextStatus, tracking = {}) {
    if (!isProductId(String(orderId))) throw fail('Order not found.', 404);
    if (!Object.hasOwn(transitions, nextStatus)) throw fail('Invalid order status.');
    let order = await Order.findById(orderId);
    if (!order) throw fail('Order not found.', 404);
    const sameStatus = order.status === nextStatus;
    if (!sameStatus && !transitions[order.status]?.includes(nextStatus)) {
        throw fail(`An order cannot move from ${order.status} to ${nextStatus}.`);
    }
    if (nextStatus !== 'cancelled' && nextStatus !== 'pending' && order.paymentMethod !== 'cash_on_delivery' && order.paymentStatus !== 'paid') {
        throw fail('Online payment must be confirmed before this order can be fulfilled.');
    }
    const update = { status: nextStatus };
    if (tracking.trackingNumber !== undefined) {
        if (typeof tracking.trackingNumber !== 'string' || tracking.trackingNumber.length > 120) throw fail('Invalid tracking number.');
        update['shippingAddress.trackingNumber'] = tracking.trackingNumber.trim() || null;
    }
    if (tracking.trackingUrl !== undefined) {
        if (typeof tracking.trackingUrl !== 'string' || (tracking.trackingUrl && !/^https?:\/\//i.test(tracking.trackingUrl))) throw fail('Tracking URL must be an HTTP or HTTPS URL.');
        update['shippingAddress.trackingUrl'] = tracking.trackingUrl.trim() || null;
    }
    if (!sameStatus && nextStatus === 'cancelled') {
        update.refundRequired = order.paymentStatus === 'paid';
        update.inventoryReleasePending = true;
        // Historical records have no reservation ledger; only the winning transition restores them.
        if (!order.inventoryManaged) update.inventoryReleased = true;
    }
    // A state-and-payment predicate prevents concurrent shipping/cancellation/payment updates from winning together.
    if (!sameStatus || Object.keys(update).length > 1) {
        const updated = await Order.findOneAndUpdate({ _id: order._id, status: order.status, paymentStatus: order.paymentStatus },
            { $set: update }, { new: true, runValidators: true });
        if (!updated) throw fail('Order changed while you were updating it. Please refresh and try again.', 409);
        order = updated;
    }
    if (nextStatus === 'cancelled' && (!sameStatus || (order.inventoryManaged && order.inventoryReleasePending))) {
        await releaseInventory(order);
        await releaseCoupon(order);
        order = await Order.findByIdAndUpdate(order._id, { $set: { inventoryReleased: true, inventoryReleasePending: false } }, { new: true });
    }
    if (nextStatus === 'delivered' && order.inventoryManaged) {
        // A fulfilled order no longer needs active inventory reservations.
        await Product.updateMany({ 'stockReservations.orderId': order._id }, { $pull: { stockReservations: { orderId: order._id } } });
    }
    return order;
}

module.exports = { transitionOrder, reserveInventory, releaseInventory, reserveCoupon, releaseCoupon, inventoryItems };
