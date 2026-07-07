import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const measurementsSchema = new mongoose.Schema(
  {
    height: Number, // cm
    shoulder: Number, // cm
    chest: Number,
    waist: Number,
    hip: Number,
    bodyType: {
      type: String,
      enum: ['Rectangle', 'Hourglass', 'Pear', 'Inverted Triangle', 'Apple', 'Athletic'],
    },
    skinTone: { type: String, enum: ['Fair', 'Wheatish', 'Medium', 'Deep'] },
    skinColorHex: String,
    heightUnit: { type: String, enum: ['cm', 'ft'] },
    measuredAt: Date,
  },
  { _id: false }
);

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    size: { type: String, required: true },
    color: String,
    quantity: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    savedMeasurements: measurementsSchema,
    cart: [cartItemSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

userSchema.methods.checkPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  const { _id, name, email, role, savedMeasurements, wishlist } = this;
  return { _id, name, email, role, savedMeasurements, wishlist };
};

export default mongoose.model('User', userSchema);
