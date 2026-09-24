const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const vehicleInfoSchema = new mongoose.Schema(
  {
    make: { type: String, trim: true, required: true },
    model: { type: String, trim: true, required: true },
    registrationNumber: { type: String, trim: true, uppercase: true, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, match: [/^03\d{9}$/, 'Phone number must be an 11-digit Pakistani mobile number, e.g. 03001234567.'] },
    cnic: { type: String, required: true, unique: true, trim: true, match: [/^\d{5}-\d{7}-\d$/, 'CNIC must use the format 12345-1234567-1.'] },
    role: { type: String, required: true, enum: ['driver', 'passenger', 'admin'] },
    vehicleType: { type: String, enum: ['car', 'motorcycle'] },
    verificationStatus: {
      type: String,
      enum: ['not_started', 'pending', 'verified', 'rejected'],
      default: 'not_started',
    },
    rideCancellationCount: { type: Number, default: 0, min: 0 },
    accountBlockedUntil: { type: Date },
    vehicleInfo: {
      type: vehicleInfoSchema,
      required: function requiredForDrivers() {
        return this.role === 'driver';
      },
    },
    password: { type: String, required: true, minlength: 6, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
