import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

// Size charts in cm, loosely based on common Indian/Asian unisex brand charts.
const menTopChart = [
  { size: 'XS', shoulder: 42, chest: 88, waist: 82, hip: 90 },
  { size: 'S', shoulder: 44, chest: 94, waist: 88, hip: 96 },
  { size: 'M', shoulder: 46, chest: 100, waist: 94, hip: 102 },
  { size: 'L', shoulder: 48, chest: 106, waist: 100, hip: 108 },
  { size: 'XL', shoulder: 50, chest: 112, waist: 106, hip: 114 },
  { size: 'XXL', shoulder: 52, chest: 118, waist: 112, hip: 120 },
];

const womenTopChart = [
  { size: 'XS', shoulder: 36, chest: 82, waist: 66, hip: 90 },
  { size: 'S', shoulder: 37.5, chest: 87, waist: 71, hip: 95 },
  { size: 'M', shoulder: 39, chest: 92, waist: 76, hip: 100 },
  { size: 'L', shoulder: 40.5, chest: 98, waist: 82, hip: 106 },
  { size: 'XL', shoulder: 42, chest: 104, waist: 88, hip: 112 },
  { size: 'XXL', shoulder: 43.5, chest: 110, waist: 94, hip: 118 },
];

const bottomChart = (base) =>
  ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size, i) => ({
    size,
    waist: base + i * 6,
    hip: base + 14 + i * 6,
  }));

const kidsChart = [
  { size: 'XS', shoulder: 30, chest: 62, waist: 56, hip: 64 },
  { size: 'S', shoulder: 32, chest: 66, waist: 59, hip: 68 },
  { size: 'M', shoulder: 34, chest: 70, waist: 62, hip: 72 },
  { size: 'L', shoulder: 36, chest: 74, waist: 65, hip: 76 },
];

// Solid-colour placeholder images (SVG data URIs) for products without real photos.
// Virtual try-on requires JPEG/PNG garment photos — a few products below use real URLs.
const img = (label, bg, fg = '#ffffff') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="50%" fill="${fg}" font-family="Georgia, serif" font-size="34" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const photo = {
  oxfordShirt: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80&auto=format&fit=crop',
  crewTee: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80&auto=format&fit=crop',
  wrapDress: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80&auto=format&fit=crop',
};

async function run() {
  await connectDB();

  console.log('[seed] clearing existing data…');
  await Promise.all([Category.deleteMany({}), Product.deleteMany({})]);

  console.log('[seed] creating categories…');
  const mk = async (name, parent = null) =>
    Category.create({
      name,
      parentCategory: parent?._id || null,
      slug: (parent ? `${parent.name}-${name}` : name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
    });

  const men = await mk('Men');
  const women = await mk('Women');
  const kids = await mk('Kids');
  const menShirts = await mk('Shirts', men);
  const menTshirts = await mk('T-Shirts', men);
  const menTrousers = await mk('Trousers', men);
  const menEthnic = await mk('Ethnic Wear', men);
  const womenDresses = await mk('Dresses', women);
  const womenTops = await mk('Tops', women);
  const womenEthnic = await mk('Ethnic Wear', women);
  const womenJeans = await mk('Jeans', women);
  const kidsTees = await mk('T-Shirts', kids);
  const kidsDresses = await mk('Dresses', kids);

  console.log('[seed] creating products…');
  const P = (data) => Product.create(data);
  await Promise.all([
    P({
      name: 'Oxford Slim-Fit Shirt', description: 'Crisp cotton oxford with a tailored slim fit. A wardrobe staple that works from boardroom to brunch.',
      category: men._id, subCategory: menShirts._id, price: 1799, stock: 42, featured: true,
      images: [photo.oxfordShirt], colors: ['Sky Blue', 'White'],
      suitedBodyTypes: ['Rectangle', 'Athletic', 'Inverted Triangle'], suitedSkinTones: ['Fair', 'Wheatish', 'Medium', 'Deep'],
      sizeChart: menTopChart,
    }),
    P({
      name: 'Linen Resort Shirt', description: 'Breathable pure linen in a relaxed cut — made for warm evenings and easy weekends.',
      category: men._id, subCategory: menShirts._id, price: 2199, stock: 28, featured: true,
      images: [img('Linen Shirt', '#c9a86a', '#3d2f1a')], colors: ['Sand', 'Olive'],
      suitedBodyTypes: ['Apple', 'Rectangle'], suitedSkinTones: ['Wheatish', 'Medium', 'Deep'],
      sizeChart: menTopChart,
    }),
    P({
      name: 'Essential Crew Tee', description: 'Heavyweight combed cotton tee with a clean, structured drape. No logos, no fuss.',
      category: men._id, subCategory: menTshirts._id, price: 799, stock: 120,
      images: [photo.crewTee], colors: ['Black', 'White', 'Navy'],
      suitedBodyTypes: [], suitedSkinTones: [],
      sizeChart: menTopChart,
    }),
    P({
      name: 'Tapered Chino Trousers', description: 'Stretch-cotton chinos with a modern taper. Polished enough for work, comfortable enough for travel.',
      category: men._id, subCategory: menTrousers._id, price: 1999, stock: 35,
      images: [img('Chinos', '#6b705c')], colors: ['Khaki', 'Charcoal'],
      suitedBodyTypes: ['Athletic', 'Rectangle', 'Pear'], suitedSkinTones: [],
      sizeChart: bottomChart(76),
    }),
    P({
      name: 'Classic Kurta', description: 'Handloom-inspired cotton kurta with mandarin collar. Understated festive elegance.',
      category: men._id, subCategory: menEthnic._id, price: 1499, stock: 22, featured: true,
      images: [img('Kurta', '#7c3f58')], colors: ['Maroon', 'Cream'],
      suitedBodyTypes: ['Apple', 'Rectangle', 'Athletic'], suitedSkinTones: ['Wheatish', 'Medium', 'Deep'],
      sizeChart: menTopChart,
    }),
    P({
      name: 'Wrap Midi Dress', description: 'Fluid viscose wrap dress that cinches at the waist and skims everywhere else.',
      category: women._id, subCategory: womenDresses._id, price: 2499, stock: 30, featured: true,
      images: [photo.wrapDress], colors: ['Terracotta', 'Black'],
      suitedBodyTypes: ['Hourglass', 'Pear', 'Rectangle'], suitedSkinTones: ['Wheatish', 'Medium', 'Deep'],
      sizeChart: womenTopChart,
    }),
    P({
      name: 'A-Line Floral Dress', description: 'Ditsy floral A-line with a flattering scoop neck — flares gently from the waist.',
      category: women._id, subCategory: womenDresses._id, price: 2199, stock: 26,
      images: [img('Floral Dress', '#5c6b73')], colors: ['Dusty Blue', 'Blush'],
      suitedBodyTypes: ['Pear', 'Apple', 'Hourglass'], suitedSkinTones: ['Fair', 'Wheatish'],
      sizeChart: womenTopChart,
    }),
    P({
      name: 'Satin Camisole Top', description: 'Bias-cut satin cami with delicate straps. Layer it or let it shine solo.',
      category: women._id, subCategory: womenTops._id, price: 1299, stock: 44,
      images: [img('Satin Cami', '#a67f8e')], colors: ['Champagne', 'Emerald'],
      suitedBodyTypes: ['Hourglass', 'Rectangle', 'Inverted Triangle'], suitedSkinTones: ['Fair', 'Medium'],
      sizeChart: womenTopChart,
    }),
    P({
      name: 'Anarkali Kurta Set', description: 'Flowing anarkali with churidar and dupatta in festive jewel tones.',
      category: women._id, subCategory: womenEthnic._id, price: 3499, stock: 18, featured: true,
      images: [img('Anarkali', '#31572c')], colors: ['Emerald', 'Royal Blue'],
      suitedBodyTypes: ['Apple', 'Pear', 'Rectangle', 'Hourglass'], suitedSkinTones: ['Wheatish', 'Medium', 'Deep'],
      sizeChart: womenTopChart,
    }),
    P({
      name: 'High-Rise Slim Jeans', description: 'Sculpting high-rise denim with just enough stretch to keep its shape all day.',
      category: women._id, subCategory: womenJeans._id, price: 2299, stock: 38,
      images: [img('Slim Jeans', '#33415c')], colors: ['Indigo', 'Washed Black'],
      suitedBodyTypes: ['Hourglass', 'Pear', 'Athletic'], suitedSkinTones: [],
      sizeChart: bottomChart(64),
    }),
    P({
      name: 'Dino Graphic Tee', description: 'Soft cotton tee with a friendly dino print. Built to survive the playground.',
      category: kids._id, subCategory: kidsTees._id, price: 499, stock: 60,
      images: [img('Dino Tee', '#3a7d44')], colors: ['Green', 'Yellow'],
      suitedBodyTypes: [], suitedSkinTones: [],
      sizeChart: kidsChart,
    }),
    P({
      name: 'Twirl Party Dress', description: 'Tulle-layered party dress made for maximum twirl.',
      category: kids._id, subCategory: kidsDresses._id, price: 1299, stock: 20,
      images: [img('Party Dress', '#b56576')], colors: ['Pink', 'Lilac'],
      suitedBodyTypes: [], suitedSkinTones: [],
      sizeChart: kidsChart,
    }),
  ]);

  console.log('[seed] ensuring admin user…');
  let admin = await User.findOne({ email: 'admin@store.test' });
  if (!admin) {
    admin = new User({ name: 'Store Admin', email: 'admin@store.test', role: 'admin' });
    await admin.setPassword('admin123');
    await admin.save();
  }

  console.log('[seed] done. Admin login: admin@store.test / admin123');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
