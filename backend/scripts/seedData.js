// scripts/seedData.js - Populate database with sample data (Updated with Users)

const mongoose = require('mongoose');
const Product = require('../models/product');
const Order = require('../models/Order');
const User = require('../models/User');
const connectDB = require('../config/db');

// Sample products data
const sampleProducts = [
    {
        name: 'Mountain Design',
        description: 'Premium cotton T-shirt with mountain graphic print. Made from 100% organic cotton, perfect for outdoor adventures.',
        price: 19.99,
        category: 'graphic',
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        colors: ['Blue', 'Black', 'Red', 'White', 'Gray'],
        mainImage: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400',
        images: [
            { url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400', altText: 'Mountain Design Front' },
            { url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400', altText: 'Mountain Design Back' }
        ],
        stock: 150,
        tags: ['outdoor', 'nature', 'adventure', 'graphic'],
        rating: 4.5,
        reviewsCount: 42,
        featured: true
    },
    {
        name: 'Abstract Art',
        description: 'Colorful abstract pattern on soft cotton. Unique design that stands out in any crowd.',
        price: 22.99,
        category: 'graphic',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: ['Purple', 'Teal', 'Orange', 'Multicolor'],
        mainImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
        images: [
            { url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', altText: 'Abstract Art Front' },
            { url: 'https://images.unsplash.com/photo-1521572163474-df123a1eb820?w=400', altText: 'Abstract Art Detail' }
        ],
        stock: 85,
        tags: ['art', 'colorful', 'unique', 'modern'],
        rating: 4.2,
        reviewsCount: 28,
        featured: true
    },
    {
        name: 'Minimal Logo',
        description: 'Simple and elegant logo design. Perfect for everyday wear with a professional touch.',
        price: 17.99,
        category: 'plain',
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        colors: ['Black', 'White', 'Gray', 'Navy'],
        mainImage: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400',
        images: [
            { url: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400', altText: 'Minimal Logo Front' },
            { url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400', altText: 'Minimal Logo Side' }
        ],
        stock: 200,
        tags: ['minimal', 'simple', 'logo', 'casual'],
        rating: 4.7,
        reviewsCount: 56,
        featured: true
    },
    {
        name: 'Sports Performance',
        description: 'Moisture-wicking T-shirt for sports and workouts. Lightweight and breathable.',
        price: 24.99,
        category: 'sports',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: ['Black', 'Red', 'Blue', 'Green'],
        mainImage: 'https://images.unsplash.com/photo-1578763460786-98a74c8b8b37?w=400',
        images: [
            { url: 'https://images.unsplash.com/photo-1578763460786-98a74c8b8b37?w=400', altText: 'Sports T-shirt' },
            { url: 'https://images.unsplash.com/photo-1523381140794-a1eef18a37c1?w=400', altText: 'Sports T-shirt Detail' }
        ],
        stock: 120,
        tags: ['sports', 'fitness', 'workout', 'performance'],
        rating: 4.8,
        reviewsCount: 89,
        featured: false
    },
    {
        name: 'Custom Name Print',
        description: 'Personalized T-shirt with custom name printing. Choose your favorite color and size.',
        price: 29.99,
        category: 'custom',
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        colors: ['White', 'Black', 'Red', 'Blue', 'Yellow'],
        mainImage: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
        images: [
            { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400', altText: 'Custom T-shirt Example' },
            { url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400', altText: 'Custom Printing Detail' }
        ],
        stock: 0, // Out of stock to show functionality
        tags: ['custom', 'personalized', 'name', 'unique'],
        rating: 4.9,
        reviewsCount: 127,
        featured: false
    },
    {
        name: 'Vintage Band',
        description: 'Vintage band logo T-shirt for music lovers. Soft cotton with retro design.',
        price: 21.99,
        category: 'graphic',
        sizes: ['M', 'L', 'XL'],
        colors: ['Black', 'White', 'Gray'],
        mainImage: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400',
        images: [
            { url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400', altText: 'Vintage Band Front' }
        ],
        stock: 45,
        tags: ['vintage', 'music', 'band', 'retro'],
        rating: 4.4,
        reviewsCount: 31,
        featured: true
    },
    {
        name: 'Striped Classic',
        description: 'Classic striped T-shirt for casual wear. Timeless design that never goes out of style.',
        price: 18.99,
        category: 'plain',
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        colors: ['Navy/White', 'Black/White', 'Red/White'],
        mainImage: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400',
        images: [
            { url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400', altText: 'Striped T-shirt' }
        ],
        stock: 175,
        tags: ['striped', 'classic', 'casual', 'timeless'],
        rating: 4.6,
        reviewsCount: 64,
        featured: false
    },
    {
        name: 'Eco-Friendly Organic',
        description: '100% organic cotton T-shirt. Environmentally friendly and sustainable.',
        price: 26.99,
        category: 'plain',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: ['Natural', 'Green', 'Blue'],
        mainImage: 'https://images.unsplash.com/photo-1523381140794-a1eef18a37c1?w=400',
        images: [
            { url: 'https://images.unsplash.com/photo-1523381140794-a1eef18a37c1?w=400', altText: 'Organic T-shirt' }
        ],
        stock: 90,
        tags: ['eco-friendly', 'organic', 'sustainable', 'green'],
        rating: 4.9,
        reviewsCount: 78,
        featured: true
    }
];

// Sample users data
const sampleUsers = [
    {
        name: 'Admin User',
        email: 'admin@tshirtco.com',
        password: 'admin123',
        role: 'admin',
        emailVerified: true,
        isActive: true
    },
    {
        name: 'John Customer',
        email: 'customer@example.com',
        password: 'password123',
        role: 'customer',
        emailVerified: true,
        isActive: true
    },
    {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        password: 'password123',
        role: 'customer',
        emailVerified: true,
        isActive: true
    },
    {
        name: 'Bob Wilson',
        email: 'bob.wilson@example.com',
        password: 'password123',
        role: 'customer',
        emailVerified: false,
        isActive: true
    }
];

// Sample orders data
const sampleOrders = [
    {
        customer: {
            name: 'John Customer',
            email: 'customer@example.com',
            phone: '+1234567890'
        },
        shippingAddress: {
            street: '123 Main Street',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'USA'
        },
        subtotal: 39.98,
        shippingFee: 5.99,
        tax: 3.60,
        totalAmount: 49.57,
        status: 'delivered',
        paymentStatus: 'paid',
        paymentMethod: 'credit_card',
        notes: 'Please deliver after 5 PM',
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    },
    {
        customer: {
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            phone: '+1987654321'
        },
        shippingAddress: {
            street: '456 Oak Avenue',
            city: 'Los Angeles',
            state: 'CA',
            zipCode: '90001',
            country: 'USA'
        },
        subtotal: 22.99,
        shippingFee: 5.99,
        tax: 2.30,
        totalAmount: 31.28,
        status: 'processing',
        paymentStatus: 'paid',
        paymentMethod: 'paypal',
        estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    },
    {
        customer: {
            name: 'Bob Wilson',
            email: 'bob.wilson@example.com',
            phone: '+1555123456'
        },
        shippingAddress: {
            street: '789 Pine Road',
            city: 'Chicago',
            state: 'IL',
            zipCode: '60601',
            country: 'USA'
        },
        subtotal: 67.97,
        shippingFee: 5.99,
        tax: 5.44,
        totalAmount: 79.40,
        status: 'shipped',
        paymentStatus: 'paid',
        paymentMethod: 'credit_card',
        notes: 'Gift wrapping requested',
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
    }
];

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');
        
        // Connect to database
        await connectDB();
        
        // Clear existing data
        console.log('🧹 Clearing existing data...');
        await Product.deleteMany({});
        await Order.deleteMany({});
        await User.deleteMany({});
        console.log('✅ Existing data cleared');
        
        // Create users
        console.log('👥 Creating users...');
        const createdUsers = [];
        
        for (const userData of sampleUsers) {
            try {
                const user = await User.create({
                    name: userData.name,
                    email: userData.email,
                    password: userData.password,
                    passwordConfirm: userData.password,
                    role: userData.role,
                    emailVerified: userData.emailVerified,
                    isActive: userData.isActive
                });
                createdUsers.push(user);
                console.log(`   ✅ Created user: ${user.email} (${user.role})`);
            } catch (error) {
                console.error(`   ❌ Error creating user ${userData.email}:`, error.message);
            }
        }
        console.log(`✅ ${createdUsers.length} users created`);
        
        // Insert products
        console.log('📦 Inserting products...');
        const createdProducts = await Product.insertMany(sampleProducts);
        console.log(`✅ ${createdProducts.length} products inserted`);
        
        // Get user references for orders
        const johnCustomer = createdUsers.find(u => u.email === 'customer@example.com');
        const janeCustomer = createdUsers.find(u => u.email === 'jane.smith@example.com');
        const bobCustomer = createdUsers.find(u => u.email === 'bob.wilson@example.com');
        
        // Add user references and product details to orders
        sampleOrders[0].user = johnCustomer ? johnCustomer._id : null;
        sampleOrders[1].user = janeCustomer ? janeCustomer._id : null;
        sampleOrders[2].user = bobCustomer ? bobCustomer._id : null;
        
        // Add product references to orders
        sampleOrders[0].items = [
            {
                productId: createdProducts[0]._id,
                name: createdProducts[0].name,
                size: 'L',
                color: 'Blue',
                quantity: 2,
                price: createdProducts[0].price,
                image: createdProducts[0].mainImage
            }
        ];
        
        sampleOrders[1].items = [
            {
                productId: createdProducts[1]._id,
                name: createdProducts[1].name,
                size: 'M',
                color: 'Purple',
                quantity: 1,
                price: createdProducts[1].price,
                image: createdProducts[1].mainImage
            }
        ];
        
        sampleOrders[2].items = [
            {
                productId: createdProducts[2]._id,
                name: createdProducts[2].name,
                size: 'XL',
                color: 'Black',
                quantity: 2,
                price: createdProducts[2].price,
                image: createdProducts[2].mainImage
            },
            {
                productId: createdProducts[3]._id,
                name: createdProducts[3].name,
                size: 'M',
                color: 'Red',
                quantity: 1,
                price: createdProducts[3].price,
                image: createdProducts[3].mainImage
            }
        ];
        
        // Generate order numbers
        const orderPrefix = 'ORD';
        const date = new Date();
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        
        sampleOrders[0].orderNumber = `${orderPrefix}-${year}${month}-0001`;
        sampleOrders[1].orderNumber = `${orderPrefix}-${year}${month}-0002`;
        sampleOrders[2].orderNumber = `${orderPrefix}-${year}${month}-0003`;
        
        // Insert orders
        console.log('📝 Inserting orders...');
        const createdOrders = await Order.insertMany(sampleOrders);
        console.log(`✅ ${createdOrders.length} orders inserted`);
        
        console.log('\n🎉 Database seeding completed successfully!');
        console.log('\n📊 Sample Data Overview:');
        console.log(`   Users: ${createdUsers.length}`);
        console.log(`   Products: ${createdProducts.length}`);
        console.log(`   Orders: ${createdOrders.length}`);
        
        console.log('\n👑 Admin Credentials:');
        console.log(`   Email: ngtbharath@gmail.com`);
        console.log(`   Password: admin@123`);
        console.log(`   Role: admin`);

        
        console.log('\n🔗 MongoDB Compass Connection:');
        console.log(`   Connect to: ${process.env.MONGODB_URI}`);
        
        console.log('\n🚀 API Endpoints:');
        console.log(`   Server: http://localhost:5000`);
        console.log(`   Products: http://localhost:5000/api/products`);
        console.log(`   Auth: http://localhost:5000/api/auth/login`);
        console.log(`   Orders: http://localhost:5000/api/orders`);
        
        console.log('\n💡 Tips:');
        console.log(`   1. Use admin credentials to access protected admin routes`);
        console.log(`   2. Products include featured items for homepage display`);
        console.log(`   3. Some products are out of stock to show functionality`);
        console.log(`   4. Orders have different statuses for demonstration`);
        
        // Exit process
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Seeding error:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run seeding if script is called directly
if (require.main === module) {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
        console.error('❌ Unhandled Promise Rejection:', err);
        process.exit(1);
    });
    
    seedDatabase();
}

module.exports = seedDatabase;