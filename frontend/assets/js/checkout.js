/**
 * DYD-Cloths Checkout Logic
 * Handles multi-step order placement and summary.
 */

document.addEventListener('DOMContentLoaded', () => {
    Checkout.init();
});

const Checkout = {
    currentStep: 1,
    shippingFee: 99,
    couponApplied: null,
    discountAmount: 0,

    freeShippingThreshold: 499,
    enableCod: true,

    init: async () => {
        if (CartManager.getCount() === 0) {
            Utils.showToast('Your cart is empty', 'warning');
            setTimeout(() => window.location.href = 'shop.html', 1500);
            return;
        }

        // Fetch settings dynamically to override default shipping & COD values
        try {
            const settingsRes = await API.get('/settings');
            if (settingsRes.success && settingsRes.data) {
                const settings = settingsRes.data;
                if (settings.shipping_fee !== undefined) {
                    Checkout.shippingFee = parseFloat(settings.shipping_fee);
                }
                if (settings.free_shipping_threshold !== undefined) {
                    Checkout.freeShippingThreshold = parseFloat(settings.free_shipping_threshold);
                }
                if (settings.enable_cod !== undefined) {
                    Checkout.enableCod = settings.enable_cod === 'true';
                }
            }
        } catch (err) {
            console.warn('Could not load checkout settings, using defaults:', err);
        }

        Checkout.prefillUserData();
        Checkout.updateSummary();
        Checkout.setupEventListeners();
        Checkout.adjustPaymentMethods();
    },

    adjustPaymentMethods: () => {
        if (Checkout.enableCod === false) {
            const codMethod = document.getElementById('pmCOD');
            if (codMethod) codMethod.style.display = 'none';
        }
    },
        showLoading: (show) => {
        let overlay = document.getElementById('checkoutLoadingOverlay');
        if (show && !overlay) {
            overlay = document.createElement('div');
            overlay.id = 'checkoutLoadingOverlay';
            overlay.className = 'checkout-loading-overlay';
            overlay.innerHTML = `
                <div class="checkout-loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Processing your order...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    },
    prefillUserData: () => {
        const user = AuthManager.user;
        if (!user) return;

        const form = document.getElementById('checkoutForm');
        if (form) {
            const firstNameInput = form.elements['firstName'];
            const lastNameInput = form.elements['lastName'];
            const emailInput = form.elements['email'];
            const phoneInput = form.elements['phone'];
            
            if (firstNameInput && lastNameInput) {
                const nameParts = user.name.split(' ');
                firstNameInput.value = nameParts[0] || '';
                lastNameInput.value = nameParts.slice(1).join(' ') || '';
            }
            if (emailInput) emailInput.value = user.email || '';
            if (phoneInput) phoneInput.value = user.phone || '';
        }
    },

    updateSummary: () => {
        const subtotal = CartManager.getTotal();
        const discount = Checkout.discountAmount;
        const afterDiscount = subtotal - discount;
        
        // Calculate shipping with dynamic free shipping threshold
        let shipping = Checkout.shippingFee;
        const threshold = Checkout.freeShippingThreshold || 499;
        if (afterDiscount >= threshold || afterDiscount <= 0) {
            shipping = 0;
        }
        
        const total = afterDiscount + shipping;

        Utils.setHTML('summarySubtotal', Utils.formatINR(subtotal));
        
        if (discount > 0) {
            let discountHtml = `<div class="total-row discount-row">
                <span>Discount (${Checkout.couponApplied?.code})</span>
                <span class="discount-amount">-${Utils.formatINR(discount)}</span>
            </div>`;
            const summaryTotals = document.querySelector('.order-totals');
            const existingDiscount = document.querySelector('.discount-row');
            if (existingDiscount) {
                existingDiscount.remove();
            }
            const shippingRow = document.querySelector('.total-row:not(.final)');
            if (shippingRow) {
                shippingRow.insertAdjacentHTML('beforebegin', discountHtml);
            }
        } else {
            const existingDiscount = document.querySelector('.discount-row');
            if (existingDiscount) existingDiscount.remove();
        }
        
        Utils.setHTML('summaryShipping', Utils.formatINR(shipping));
        Utils.setHTML('summaryTotal', Utils.formatINR(total));

        const container = document.getElementById('summaryItems');
        if (container) {
            container.innerHTML = CartManager.items.map(item => `
                <div class="order-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="item-info">
                        <p class="item-name">${item.name}</p>
                        <p class="item-meta">Size: ${item.size} | Qty: ${item.quantity}</p>
                    </div>
                    <span class="item-price">${Utils.formatINR(item.price * item.quantity)}</span>
                </div>
            `).join('');
        }
    },

    applyCoupon: async () => {
        const codeInput = document.getElementById('couponCode');
        const messageDiv = document.getElementById('couponMessage');
        const code = codeInput?.value.trim();
        
        if (!code) {
            Checkout.showCouponMessage('Please enter a coupon code', 'error');
            return;
        }
        
        if (!AuthManager.isLoggedIn()) {
            Checkout.showCouponMessage('Please login to apply coupons', 'error');
            return;
        }
        
        Checkout.showCouponMessage('Applying coupon...', 'info');
        
        try {
            const subtotal = CartManager.getTotal();
            const res = await API.post('/coupons/validate', {
                code: code,
                cartTotal: subtotal
            });
            
            if (res.success) {
                Checkout.couponApplied = {
                    code: code,
                    discountAmount: res.data.discountAmount,
                    discountType: res.data.coupon.discountType,
                    discountValue: res.data.coupon.discountValue
                };
                Checkout.discountAmount = res.data.discountAmount;
                Checkout.showCouponMessage(`Coupon applied! You saved ${Utils.formatINR(res.data.discountAmount)}`, 'success');
                Checkout.updateSummary();
                codeInput.disabled = true;
                document.getElementById('applyCouponBtn').textContent = 'Applied';
                document.getElementById('applyCouponBtn').disabled = true;
            }
        } catch (error) {
            Checkout.showCouponMessage(error.message || 'Invalid coupon code', 'error');
            Checkout.couponApplied = null;
            Checkout.discountAmount = 0;
        }
    },

    showCouponMessage: (message, type) => {
        const messageDiv = document.getElementById('couponMessage');
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = `coupon-message ${type}`;
            setTimeout(() => {
                if (messageDiv.textContent === message) {
                    messageDiv.textContent = '';
                    messageDiv.className = 'coupon-message';
                }
            }, 5000);
        }
    },

    nextStep: () => {
        if (Checkout.currentStep === 1 && !Checkout.validateStep1()) return;
        if (Checkout.currentStep === 2 && !Checkout.validateStep2()) return;

        Checkout.currentStep++;
        Checkout.showStep(Checkout.currentStep);
        if (Checkout.currentStep === 3) Checkout.populateReview();
    },

    prevStep: () => {
        Checkout.currentStep--;
        Checkout.showStep(Checkout.currentStep);
    },

    showStep: (step) => {
        const sections = document.querySelectorAll('.checkout-section');
        sections.forEach((s, i) => {
            s.style.display = (i + 1) === step ? 'block' : 'none';
        });

        const steps = document.querySelectorAll('.step');
        steps.forEach((s, i) => {
            s.classList.toggle('active', (i + 1) === step);
            s.classList.toggle('completed', (i + 1) < step);
        });
    },

    validateStep1: () => {
        const form = document.getElementById('checkoutForm');
        const required = ['firstName', 'lastName', 'email', 'address', 'city', 'zipCode'];
        
        for (let field of required) {
            const element = form.elements[field];
            if (!element || !element.value.trim()) {
                Utils.showToast(`Please fill in your ${field}`, 'warning');
                if (element) element.focus();
                return false;
            }
        }
        
        const email = form.elements['email'].value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Utils.showToast('Please enter a valid email address', 'warning');
            form.elements['email'].focus();
            return false;
        }
        
        return true;
    },

    validateStep2: () => {
        const selectedMethod = document.querySelector('.payment-method.selected')?.dataset.method;
        if (!selectedMethod) {
            Utils.showToast('Please select a payment method', 'warning');
            return false;
        }
        return true;
    },

    populateReview: () => {
        const form = document.getElementById('checkoutForm');
        const container = document.getElementById('orderReviewDetails');
        const selectedMethod = document.querySelector('.payment-method.selected')?.dataset.method;
        
        let paymentMethodName = 'Cash on Delivery';
        if (selectedMethod === 'razorpay') paymentMethodName = 'Online Payment (Razorpay)';
        else if (selectedMethod === 'cod') paymentMethodName = 'Cash on Delivery';

        container.innerHTML = `
            <div class="review-grid">
                <div class="review-col">
                    <h4>Shipping Address</h4>
                    <p>${form.elements['firstName'].value} ${form.elements['lastName'].value}</p>
                    <p>${form.elements['address'].value}</p>
                    <p>${form.elements['city'].value}, ${form.elements['state']?.value || ''} ${form.elements['zipCode'].value}</p>
                </div>
                <div class="review-col">
                    <h4>Contact</h4>
                    <p>${form.elements['email'].value}</p>
                    <p>${form.elements['phone']?.value || 'No phone provided'}</p>
                </div>
                <div class="review-col">
                    <h4>Payment Method</h4>
                    <p>${paymentMethodName}</p>
                </div>
            </div>
        `;
    },

    // Helper function to map frontend method to backend enum
    mapPaymentMethod: (frontendMethod) => {
        switch (frontendMethod) {
            case 'razorpay': return 'razorpay';
            case 'cod': return 'cash_on_delivery';
            default: return 'cash_on_delivery';
        }
    },

    placeOrder: async () => {
        const form = document.getElementById('checkoutForm');
        const submitBtn = document.querySelector('.checkout-section button[type="submit"]');
        if (!submitBtn) return;

        const selectedMethod = document.querySelector('.payment-method.selected')?.dataset.method || 'cod';

        const subtotal = CartManager.getTotal();
        const discount = Checkout.discountAmount;
        const afterDiscount = subtotal - discount;
        let shippingFee = Checkout.shippingFee;
        const threshold = Checkout.freeShippingThreshold || 499;
        if (afterDiscount >= threshold || afterDiscount <= 0) shippingFee = 0;
        const totalAmount = afterDiscount + shippingFee;

        const buildOrderPayload = (extraPayment = {}) => ({
            customer: {
                name: `${form.elements['firstName'].value} ${form.elements['lastName'].value}`.trim(),
                email: form.elements['email'].value,
                phone: form.elements['phone']?.value || ''
            },
            items: CartManager.items.map(i => ({
                productId: i.id,
                name: i.name,
                quantity: i.quantity,
                price: i.price,
                size: i.size,
                color: i.color,
                image: i.image
            })),
            shippingAddress: {
                street: form.elements['address'].value,
                city: form.elements['city'].value,
                state: form.elements['state']?.value || 'N/A',
                zipCode: form.elements['zipCode'].value,
                country: 'India'
            },
            paymentMethod: Checkout.mapPaymentMethod(selectedMethod),
            subtotal,
            discountAmount: discount,
            couponCode: Checkout.couponApplied?.code || null,
            shippingFee,
            tax: 0,
            totalAmount,
            notes: 'Order placed via DYD-Cloths website',
            ...extraPayment
        });

        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        submitBtn.disabled = true;
        Checkout.showLoading(true);

        try {
            if (selectedMethod === 'cod') {
                // COD: Create order directly
                const res = await API.post('/orders', buildOrderPayload());
                if (res.success) {
                    Utils.showToast('Order placed successfully!', 'success');
                    CartManager.clear();
                    setTimeout(() => window.location.href = `order-confirmation.html?id=${res.data?._id || ''}`, 2000);
                } else {
                    throw new Error(res.error || 'Order failed');
                }
            } else {
                // RAZORPAY: 1) Create order in our DB (pending), 2) Open Razorpay, 3) Verify on success

                // Step 1: Create pending order
                const orderRes = await API.post('/orders', buildOrderPayload({ paymentStatus: 'pending' }));
                if (!orderRes.success) throw new Error(orderRes.error || 'Could not create order');
                const dbOrderId = orderRes.data._id;

                // Step 2: Create Razorpay payment order
                const payRes = await API.post('/payment/create-order', { amount: totalAmount });
                if (!payRes.success) throw new Error('Could not initialize payment');

                // Step 3: Open Razorpay modal
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                Checkout.showLoading(false);

                const rzpOptions = {
                    key: payRes.data.key,
                    amount: payRes.data.amount,
                    currency: payRes.data.currency,
                    name: 'DYD-Cloths',
                    description: `Order #${orderRes.data.orderNumber}`,
                    image: 'https://via.placeholder.com/60x60/0f766e/ffffff?text=DYD',
                    order_id: payRes.data.id,
                    prefill: {
                        name: `${form.elements['firstName'].value} ${form.elements['lastName'].value}`.trim(),
                        email: form.elements['email'].value,
                        contact: form.elements['phone']?.value || ''
                    },
                    theme: { color: '#0f766e' },
                    handler: async (response) => {
                        // Step 4: Verify signature server-side
                        Checkout.showLoading(true);
                        try {
                            const verifyRes = await API.post('/payment/verify', {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                orderId: dbOrderId
                            });
                            if (verifyRes.success) {
                                Utils.showToast('Payment successful! Order confirmed.', 'success');
                                CartManager.clear();
                                setTimeout(() => window.location.href = `order-confirmation.html?id=${dbOrderId}`, 2000);
                            } else {
                                throw new Error('Payment verification failed');
                            }
                        } catch (verifyErr) {
                            Utils.showToast('Payment verification failed. Please contact support.', 'error');
                            Checkout.showLoading(false);
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            Utils.showToast('Payment cancelled. Your order is saved — complete payment anytime.', 'warning');
                        }
                    }
                };

                const rzp = new Razorpay(rzpOptions);
                rzp.open();
                rzp.on('payment.failed', (response) => {
                    Utils.showToast(`Payment failed: ${response.error.description}`, 'error');
                });
            }
        } catch (error) {
            console.error('Place order error:', error);
            Utils.showToast(error.message || 'Failed to place order. Please try again.', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            Checkout.showLoading(false);
        }
    },
    setupEventListeners: () => {
        const nextButtons = document.querySelectorAll('.next-step');
        const prevButtons = document.querySelectorAll('.prev-step');
        
        nextButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const nextStep = parseInt(btn.dataset.next);
                if (nextStep) {
                    if (Checkout.currentStep === 1 && !Checkout.validateStep1()) return;
                    if (Checkout.currentStep === 2 && !Checkout.validateStep2()) return;
                    Checkout.currentStep = nextStep;
                    Checkout.showStep(Checkout.currentStep);
                    if (Checkout.currentStep === 3) Checkout.populateReview();
                } else {
                    Checkout.nextStep();
                }
            });
        });
        
        prevButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const prevStep = parseInt(btn.dataset.prev);
                if (prevStep) {
                    Checkout.currentStep = prevStep;
                    Checkout.showStep(Checkout.currentStep);
                } else {
                    Checkout.prevStep();
                }
            });
        });
        
        const checkoutForm = document.getElementById('checkoutForm');
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (Checkout.currentStep === 3) {
                    Checkout.placeOrder();
                } else {
                    Checkout.nextStep();
                }
            });
        }

        // Payment methods click toggle
        const paymentMethods = document.querySelectorAll('.payment-method');
        paymentMethods.forEach(m => {
            m.addEventListener('click', () => {
                paymentMethods.forEach(item => item.classList.remove('selected'));
                m.classList.add('selected');

                // Show/hide Razorpay notice
                const notice = document.getElementById('razorpayNotice');
                if (notice) notice.style.display = m.dataset.method === 'razorpay' ? 'flex' : 'none';
            });
        });

        document.getElementById('applyCouponBtn')?.addEventListener('click', () => Checkout.applyCoupon());
    }
};

window.Checkout = Checkout;