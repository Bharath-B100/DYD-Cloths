// models/User.js - User Schema for authentication

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't return password in queries by default
    },
    passwordConfirm: {
        type: String,
        required: [function() { return this.isNew; }, 'Please confirm your password'],
        validate: {
            validator: function(el) {
                if (!this.isNew) return true;
                return el === this.password;
            },
            message: 'Passwords do not match'
        }
    },
        // Add these fields inside the userSchema object
    lastCart: {
        type: Array,
        default: []
    },
    lastCartUpdate: {
        type: Date,
        default: null
    },
    role: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer'
    },
phone: {
  type: String,
  validate: {
    validator: function (v) {
      if (!v || v.trim() === '') return true; // allow empty
      // Strip spaces, dashes, parens, plus sign then check 7-15 digits
      const digits = v.replace(/[\s\-\(\)\+]/g, '');
      return /^[0-9]{7,15}$/.test(digits);
    },
    message: 'Please provide a valid phone number'
  }
},

    addresses: [{
        type: {
            type: String,
            enum: ['home', 'work', 'other'],
            default: 'home'
        },
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: {
            type: String,
            default: 'USA'
        },
        isDefault: {
            type: Boolean,
            default: false
        }
    }],
    avatar: {
        type: String,
        default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: Date,
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ======================
// MIDDLEWARE (HOOKS)
// ======================

// Hash password before saving
userSchema.pre('validate', async function () {
    // example: normalize email
    if (this.email) {
        this.email = this.email.toLowerCase();
    }

    // example: auto-trim name
    if (this.name) {
        this.name = this.name.trim();
    }
});

// Update passwordChangedAt when password is modified
// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    this.password = await bcrypt.hash(this.password, 12);
    this.passwordConfirm = undefined; // VERY IMPORTANT
});


// ======================
// INSTANCE METHODS
// ======================

// Compare password for login
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(
            this.passwordChangedAt.getTime() / 1000, 
            10
        );
        return JWTTimestamp < changedTimestamp;
    }
    
    // Password not changed
    return false;
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function() {
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    
    // Hash the token and save to database
    this.passwordResetToken = require('crypto')
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    // Set expiration (10 minutes)
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    
    return resetToken;
};

// ======================
// VIRTUAL PROPERTIES
// ======================

// Virtual for getting user's initials (for avatar)
userSchema.virtual('initials').get(function() {
    if (!this.name) return 'U';
    const names = this.name.split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[1][0]).toUpperCase();
    }
    return this.name.substring(0, 2).toUpperCase();
});

// Virtual for getting user's default address
userSchema.virtual('defaultAddress').get(function() {
    if (!this.addresses || !Array.isArray(this.addresses)) return null;
    return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
});

// ======================
// INDEXES
// ======================

userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// Create the model
const User = mongoose.model('User', userSchema);

module.exports = User;
