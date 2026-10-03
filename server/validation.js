import { requireInteger, requireString } from './http.js';
import { randomUUID } from 'node:crypto';

export const categories = ['Milk & Dairy', 'Vegetables', 'Fruits', 'Bakery', 'Chicken', 'Fish', 'Pantry'];
export const deliverySlots = [
  '5:00 AM – 7:00 AM',
  '7:00 AM – 9:00 AM',
  '9:00 AM – 12:00 PM',
  '12:00 PM – 3:00 PM',
  '3:00 PM – 6:00 PM',
  '6:00 PM – 9:00 PM'
];

export function validateProduct(input, existingId) {
  const name = requireString(input.name, 'Product name', 80);
  const category = requireString(input.category, 'Category', 40);
  if (!categories.includes(category)) {
    const error = new Error('Choose a valid product category.');
    error.status = 400;
    throw error;
  }
  const image = requireString(input.image, 'Image URL', 1000, false);
  if (image && (!/^https:\/\//i.test(image) || !URL.canParse(image) || new URL(image).protocol !== 'https:')) {
    const error = new Error('Product image must use a valid HTTPS URL.');
    error.status = 400;
    throw error;
  }
  if (typeof input.active !== 'boolean' && input.active !== undefined) {
    const error = new Error('Product active status must be boolean.');
    error.status = 400;
    throw error;
  }
  return {
    id: existingId || requireString(input.id || randomUUID(), 'Product ID', 80),
    name,
    category,
    description: requireString(input.description, 'Description', 300),
    price: requireInteger(input.price, 'Price', 1, 10000000),
    unit: requireString(input.unit, 'Unit', 30),
    image,
    alt: requireString(input.alt || name, 'Image alt text', 160),
    badge: requireString(input.badge || 'Picked with care', 'Badge', 40),
    active: input.active === undefined ? true : input.active,
    updatedAt: new Date()
  };
}

export function validateCustomer(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new Error('Delivery details are required.');
    error.status = 400;
    throw error;
  }
  const phone = requireString(input.phone, 'Mobile number', 16);
  if (!/^\d{10,16}$/.test(phone)) {
    const error = new Error('Enter a valid mobile number using 10 to 16 digits.');
    error.status = 400;
    throw error;
  }
  const pin = requireString(input.pin, 'PIN code', 6);
  if (!/^\d{6}$/.test(pin)) {
    const error = new Error('Enter a valid 6-digit PIN code.');
    error.status = 400;
    throw error;
  }
  const email = requireString(input.email, 'Email', 160, false);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('Enter a valid email address.');
    error.status = 400;
    throw error;
  }
  return {
    name: requireString(input.name, 'Full name', 100),
    phone,
    email,
    addressLine1: requireString(input.addressLine1, 'House / flat and street', 160),
    area: requireString(input.area, 'Area / locality', 100),
    landmark: requireString(input.landmark, 'Landmark', 100, false),
    city: requireString(input.city, 'City / town', 80),
    state: requireString(input.state, 'State', 80),
    pin,
    instructions: requireString(input.instructions, 'Delivery instructions', 240, false),
    deliveryDay: requireString(input.deliveryDay, 'Delivery day', 80),
    deliverySlot: requireString(input.deliverySlot, 'Delivery slot', 32)
  };
}

export function validateOrderItems(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50) {
    const error = new Error('Add between 1 and 50 distinct products to your order.');
    error.status = 400;
    throw error;
  }
  const quantities = new Map();
  for (const item of input) {
    if (!item || typeof item !== 'object') {
      const error = new Error('Each order item must include a product ID and quantity.');
      error.status = 400;
      throw error;
    }
    const id = requireString(item.productId, 'Product ID', 80);
    const quantity = requireInteger(item.quantity, 'Quantity', 1, 100);
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}
