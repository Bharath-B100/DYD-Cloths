const {test}=require('node:test');
const assert=require('node:assert/strict');
const {orderConfirmationEmail}=require('../services/orderConfirmationEmail');
test('confirmation includes order details with escaped HTML and truthful payment status',()=>{
 const order={orderNumber:'DYD-123',customer:{name:'<script>bad</script>'},items:[{name:'Shirt & cap',size:'M',color:'Black',quantity:2,price:500}],shippingAddress:{street:'Test street',city:'Chennai',zipCode:'600001'},subtotal:1000,totalAmount:1050,shippingFee:50,paymentMethod:'cash_on_delivery'};
 const mail=orderConfirmationEmail(order,'https://dyd-cloths.onrender.com');
 assert.match(mail.subject,/DYD-123/);assert.match(mail.text,/Qty 2/);assert.match(mail.text,/Cash on Delivery/);assert.match(mail.html,/https:\/\/dyd-cloths.onrender.com\/track-order/);assert.ok(!mail.html.includes('<script>'));assert.match(mail.html,/&lt;script&gt;/);
 order.paymentMethod='razorpay';order.paymentStatus='pending';assert.match(orderConfirmationEmail(order,'https://example.test').text,/not a payment receipt/);
});
