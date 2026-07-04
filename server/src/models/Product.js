import mongoose from 'mongoose';

// All size chart measurements are stored in centimeters; the client converts
// for display when the unit toggle is set to inches.
const sizeRowSchema = new mongoose.Schema(
  {
    size: { type: String, required: true }, // XS, S, M, L, XL, XXL
    shoulder: Number,
    chest: Number,
    hip: Number,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    images: [String],
    colors: [String],
    // Which skin-tone categories this product's colors flatter, used by the
    // recommendation engine. Empty array = suits everyone.
    suitedSkinTones: [{ type: String, enum: ['Fair', 'Wheatish', 'Medium', 'Deep'] }],
    // Body types this cut flatters. Empty array = suits everyone.
    suitedBodyTypes: [
      {
        type: String,
        enum: ['Rectangle', 'Hourglass', 'Pear', 'Inverted Triangle', 'Apple', 'Athletic'],
      },
    ],
    sizeChart: [sizeRowSchema],
    featured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    recommendedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);
