export const defaultProducts = [
  { id: 'product-1', name: 'Fresh Cow Milk', category: 'Milk & Dairy', description: 'Gentle, creamy goodness for your morning ritual.', price: 68, unit: '1 L', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=78', alt: 'Fresh cow milk in a clear glass bottle', badge: 'Daily favourite', active: true },
  { id: 'product-2', name: 'Farm Fresh Tomatoes', category: 'Vegetables', description: 'Bright, juicy and ready for your favourite recipes.', price: 42, unit: '500 g', image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=600&q=78', alt: 'Ripe red tomatoes picked fresh', badge: 'In season', active: true },
  { id: 'product-3', name: 'Seasonal Mangoes', category: 'Fruits', description: 'Sun-kissed sweetness to share around the table.', price: 149, unit: '1 kg', image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=78', alt: 'Golden ripe mangoes', badge: 'Seasonal pick', active: true },
  { id: 'product-4', name: 'Country Sourdough Loaf', category: 'Bakery', description: 'A slow-made loaf with a crisp, golden crust.', price: 120, unit: 'loaf', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=78', alt: 'Golden country loaf', badge: 'Freshly baked', active: true }
];

export const defaultCoupons = [
  { code: 'FRESH10', type: 'percent', value: 10, active: true, createdAt: new Date('2026-01-01T00:00:00.000Z') },
  { code: 'WELCOME50', type: 'fixed', value: 50, active: true, createdAt: new Date('2026-01-01T00:00:00.000Z') }
];
