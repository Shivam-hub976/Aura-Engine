import { faker } from '@faker-js/faker';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Product from '../src/models/Product.js';
import { PRODUCT_CATEGORIES } from '../src/constants/categories.js';

const DEFAULT_TOTAL_RECORDS = 50_000;
const BATCH_SIZE = 2_500;

const BRANDS = [
  'NovaTech',
  'Kestrel',
  'Vanguard',
  'Meridian',
  'Stratos',
  'Solstice',
  'Cortex',
  'Aether',
  'Lumen',
  'Vertex',
  'Chronos',
  'Nordic',
  'Pulse',
  'Zenith',
  'OmniCore',
  'Vector',
  'Kinetic',
  'Cobalt',
  'Obsidian',
  'Helios',
];

const CATEGORY_CATALOG = {
  Electronics: {
    code: 'ELC',
    costRange: [25, 650],
    items: [
      'Digital Audio Receiver',
      'Hi-Fi Audio Amplifier',
      'Smart Audio Hub',
      '4K Ultra HD Smart TV',
      'Mesh Wi-Fi 6E Router',
      'USB-C Docking Station',
      'Portable Power Station',
      'Smart Security Camera',
      'OLED Gaming Monitor',
      'Noise-Canceling Audio Bar',
    ],
  },
  'Audio & Accessories': {
    code: 'AUD',
    costRange: [12, 320],
    items: [
      'Studio Audio Headphones',
      'Wireless Audio Earbuds',
      'Bluetooth Audio Speaker',
      'Condenser Audio Microphone',
      'USB Audio Interface',
      'Portable DAC Amplifier',
      'Surround Soundbar System',
      'Braided Aux Audio Cable',
      'Active Studio Monitor',
      'Podcast Audio Mixer',
    ],
  },
  'Computers & Laptops': {
    code: 'CMP',
    costRange: [45, 1450],
    items: [
      'Ultrabook Business Laptop',
      'Pro Workstation Laptop',
      'Gaming Performance Laptop',
      '2-in-1 Convertible Laptop',
      'Mechanical Wireless Keyboard',
      'Ergonomic Precision Mouse',
      'NVMe M.2 Solid State Drive',
      'External Thunderbolt SSD',
      'Mini Desktop Workstation',
      'Aluminum Laptop Stand',
    ],
  },
  'Home & Kitchen': {
    code: 'HMK',
    costRange: [15, 380],
    items: [
      'Espresso Coffee Machine',
      'Stainless Air Fryer',
      'HEPA Air Purifier',
      'Robot Vacuum Cleaner',
      'Cast Iron Dutch Oven',
      'Precision Sous Vide Cooker',
      'Smart Ceramic Space Heater',
      'Cordless Stick Vacuum',
      'Digital Kitchen Scale',
      'Induction Cooktop Burner',
    ],
  },
  'Office Supplies': {
    code: 'OFC',
    costRange: [6, 260],
    items: [
      'Ergonomic Mesh Office Chair',
      'Motorized Standing Desk',
      'Cross-Cut Paper Shredder',
      'Thermal Shipping Label Printer',
      'Magnetic Glass Whiteboard',
      'LED Architect Desk Lamp',
      'Heavy-Duty Desktop Stapler',
      'Dual Monitor Desk Mount',
      'Acoustic Desk Divider Panel',
      'Archival File Storage Box',
    ],
  },
  'Apparel & Footwear': {
    code: 'APP',
    costRange: [10, 160],
    items: [
      'Waterproof Trail Jacket',
      'Steel-Toe Work Boots',
      'Merino Wool Base Layer',
      'Performance Running Shoes',
      'Insulated Cargo Vest',
      'High-Visibility Safety Parka',
      'Breathable Athletic Hoodie',
      'Reinforced Utility Trousers',
      'Compression Crew Socks',
      'All-Weather Commuter Backpack',
    ],
  },
  'Sports & Outdoors': {
    code: 'SPT',
    costRange: [14, 480],
    items: [
      'Adjustable Dumbbell Set',
      'Ultralight Backpacking Tent',
      'Insulated Hydration Flask',
      'Carbon Fiber Trekking Poles',
      'Commercial Resistance Bands',
      'Portable Folding Camp Chair',
      'High-Density Yoga Mat',
      'LED Rechargeable Headlamp',
      'Hard-Shell Cooler Box',
      'GPS Fitness Smartwatch',
    ],
  },
  'Tools & Hardware': {
    code: 'TLS',
    costRange: [18, 420],
    items: [
      'Brushless Cordless Drill Kit',
      'Laser Distance Measure',
      'Torque Wrench Mechanic Set',
      'Heavy-Duty Rolling Tool Chest',
      'Digital Clamp Multimeter',
      'Rotary Hammer Drill',
      'Cordless Impact Driver',
      'Self-Leveling Cross Laser',
      'Compact Wet Dry Shop Vac',
      'Industrial Heat Gun',
    ],
  },
  Automotive: {
    code: 'AUT',
    costRange: [12, 290],
    items: [
      'Lithium Jump Starter Pack',
      'Dual-Channel 4K Dash Cam',
      'OBD2 Diagnostic Scanner',
      'Digital Tire Inflator Pump',
      'All-Weather Floor Liner Set',
      'LED Headlight Conversion Kit',
      'Cordless Car Polisher',
      'Heavy-Duty Tow Strap',
      'Magnetic Phone Vent Mount',
      'Synthetic Motor Oil Case',
    ],
  },
  'Health & Personal Care': {
    code: 'HLT',
    costRange: [8, 210],
    items: [
      'Percussion Massage Gun',
      'Sonic Electric Toothbrush',
      'Digital Blood Pressure Monitor',
      'Infrared Forehead Thermometer',
      'Smart Body Composition Scale',
      'Ultrasonic Cool Mist Humidifier',
      'First Aid Trauma Response Kit',
      'UV-C Sanitizing Case',
      'Ergonomic Cervical Pillow',
      'Rechargeable Precision Trimmer',
    ],
  },
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateStockQuantity = (reorderLevel) => {
  const roll = Math.random();
  // ~7% Out of Stock, ~15% Low Stock (at or below reorder), ~78% Healthy Stock
  if (roll < 0.07) return 0;
  if (roll < 0.22) return faker.number.int({ min: 1, max: reorderLevel });
  return faker.number.int({ min: reorderLevel + 1, max: 450 });
};

const buildProductDocument = (index) => {
  const category = PRODUCT_CATEGORIES[index % PRODUCT_CATEGORIES.length];
  const config = CATEGORY_CATALOG[category];
  const brand = pickRandom(BRANDS);
  const adjective = faker.commerce.productAdjective();
  const baseItem = pickRandom(config.items);
  const series = `S${faker.number.int({ min: 100, max: 990 })}`;

  const [minCost, maxCost] = config.costRange;
  const cost = Number(
    faker.number.float({ min: minCost, max: maxCost, fractionDigits: 2 }).toFixed(2)
  );
  // Guarantee business rule: price is strictly >= cost (18% to 110% markup)
  const markup = faker.number.float({ min: 1.18, max: 2.1, fractionDigits: 3 });
  const price = Number(Math.max(cost, cost * markup).toFixed(2));

  const reorderLevel = faker.number.int({ min: 10, max: 60 });
  const stockQuantity = generateStockQuantity(reorderLevel);

  return {
    productName: `${brand} ${adjective} ${baseItem} ${series}`,
    sku: `AUR-${config.code}-${String(index + 1).padStart(6, '0')}`,
    category,
    price,
    cost,
    stockQuantity,
    reorderLevel,
    lastUpdated: faker.date.recent({ days: 180 }),
  };
};

const seedDatabase = async (totalRecords) => {
  const startTime = Date.now();
  await connectDB();

  console.log('🧹 Clearing existing products collection...');
  await Product.deleteMany({});

  console.log('📐 Ensuring all MongoDB indexes are active...');
  await Product.syncIndexes();

  console.log(
    `📦 Seeding ${totalRecords.toLocaleString()} SKUs in batches of ${BATCH_SIZE.toLocaleString()}...`
  );

  const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
  let insertedCount = 0;

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const startIdx = batchIdx * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, totalRecords);
    const batch = new Array(endIdx - startIdx);

    for (let i = startIdx; i < endIdx; i++) {
      batch[i - startIdx] = buildProductDocument(i);
    }

    await Product.collection.insertMany(batch, { ordered: false });
    insertedCount += batch.length;

    const progress = ((insertedCount / totalRecords) * 100).toFixed(0);
    console.log(
      `   ✔ Batch ${batchIdx + 1}/${totalBatches} committed (${insertedCount.toLocaleString()}/${totalRecords.toLocaleString()} — ${progress}%)`
    );
  }

  const finalCount = await Product.estimatedDocumentCount();
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(
    `\n🚀 Seeding complete! Verified ${finalCount.toLocaleString()} SKUs in ${elapsedSeconds}s.`
  );
  await disconnectDB();
};

const destroyDatabase = async () => {
  await connectDB();
  const result = await Product.deleteMany({});
  console.log(`🗑️  Deleted ${result.deletedCount.toLocaleString()} products.`);
  await disconnectDB();
};

const run = async () => {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--destroy')) {
      await destroyDatabase();
      process.exit(0);
    }

    const countArg = args.find((arg) => arg.startsWith('--count='));
    const requestedCount = countArg
      ? Number.parseInt(countArg.split('=')[1], 10)
      : DEFAULT_TOTAL_RECORDS;

    const totalRecords =
      Number.isInteger(requestedCount) && requestedCount > 0
        ? requestedCount
        : DEFAULT_TOTAL_RECORDS;

    await seedDatabase(totalRecords);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeder failed:', error.message);
    await disconnectDB();
    process.exit(1);
  }
};

run();