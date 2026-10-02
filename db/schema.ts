import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }), code: text('code').notNull().unique(), barcode: text('barcode').unique(),
  nameAr: text('name_ar').notNull(), nameEn: text('name_en'), brand: text('brand'), category: text('category').notNull().default('coffee'), description: text('description'), variant: text('variant'),
  purchasePrice: real('purchase_price').notNull().default(0), operatingCost: real('operating_cost').notNull().default(0), salePrice: real('sale_price').notNull().default(0),
  specialPrice: real('special_price'),
  stockQuantity: integer('stock_quantity').notNull().default(0), reservedQuantity: integer('reserved_quantity').notNull().default(0), websiteQuantity: integer('website_quantity').notNull().default(0), minimumStock: integer('minimum_stock').notNull().default(0),
  visibleOnWebsite: integer('visible_on_website', { mode: 'boolean' }).notNull().default(false), archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
export const suppliers = sqliteTable('suppliers', { id: integer('id').primaryKey({ autoIncrement: true }), name: text('name').notNull(), phone: text('phone'), address: text('address'), notes: text('notes') });
export const purchases = sqliteTable('purchases', { id: integer('id').primaryKey({ autoIncrement: true }), invoiceNumber: text('invoice_number').notNull().unique(), supplierId: integer('supplier_id').references(() => suppliers.id), total: real('total').notNull().default(0), purchasedAt: text('purchased_at').notNull(), notes: text('notes') });
export const purchaseItems = sqliteTable('purchase_items', { id: integer('id').primaryKey({ autoIncrement: true }), purchaseId: integer('purchase_id').notNull().references(() => purchases.id), productId: integer('product_id').notNull().references(() => products.id), quantity: integer('quantity').notNull(), unitPurchasePrice: real('unit_purchase_price').notNull(), unitOperatingCost: real('unit_operating_cost').notNull().default(0) });
export const customers = sqliteTable('customers', { id: integer('id').primaryKey({ autoIncrement: true }), name: text('name').notNull(), phone: text('phone').notNull(), email: text('email'), governorate: text('governorate'), address: text('address'), notes: text('notes'), createdAt: text('created_at').notNull() });
export const customerAccounts = sqliteTable('customer_accounts', { id: integer('id').primaryKey({ autoIncrement: true }), customerId: integer('customer_id').notNull().unique().references(() => customers.id), phone: text('phone').notNull().unique(), phoneVerifiedAt: text('phone_verified_at').notNull(), createdAt: text('created_at').notNull(), lastLoginAt: text('last_login_at') });
export const customerAddresses = sqliteTable('customer_addresses', { id: integer('id').primaryKey({ autoIncrement: true }), customerId: integer('customer_id').notNull().references(() => customers.id), label: text('label'), governorateId: integer('governorate_id').notNull(), area: text('area'), addressLine: text('address_line').notNull(), landmark: text('landmark'), isDefault: integer('is_default', { mode:'boolean' }).notNull().default(false) });
export const otpChallenges = sqliteTable('otp_challenges', { id: integer('id').primaryKey({ autoIncrement: true }), phone: text('phone').notNull(), purpose: text('purpose').notNull(), codeHash: text('code_hash').notNull(), expiresAt: text('expires_at').notNull(), attempts: integer('attempts').notNull().default(0), consumedAt: text('consumed_at'), createdAt: text('created_at').notNull() });
export const orders = sqliteTable('orders', { id: integer('id').primaryKey({ autoIncrement: true }), orderNumber: text('order_number').notNull().unique(), customerId: integer('customer_id').references(() => customers.id), guestName: text('guest_name'), verifiedPhone: text('verified_phone').notNull().default(''), governorateId: integer('governorate_id').references(() => governorates.id), governorateName: text('governorate_name').notNull().default(''), deliveryAddress: text('delivery_address').notNull().default(''), source: text('source', { enum: ['website', 'store'] }).notNull(), status: text('status').notNull().default('new'), paymentMethod: text('payment_method').notNull(), paymentStatus: text('payment_status').notNull().default('unpaid'), subtotal: real('subtotal').notNull(), discount: real('discount').notNull().default(0), originalShipping: real('original_shipping').notNull().default(0), chargedShipping: real('charged_shipping').notNull().default(0), freeShipping: integer('free_shipping', { mode: 'boolean' }).notNull().default(false), total: real('total').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull() });
export const orderItems = sqliteTable('order_items', { id: integer('id').primaryKey({ autoIncrement: true }), orderId: integer('order_id').notNull().references(() => orders.id), productId: integer('product_id').notNull().references(() => products.id), productName: text('product_name').notNull().default(''), quantity: integer('quantity').notNull(), unitPrice: real('unit_price').notNull(), unitCost: real('unit_cost').notNull() });
export const governorates = sqliteTable('governorates', { id: integer('id').primaryKey({ autoIncrement: true }), nameAr: text('name_ar').notNull().unique(), shippingPrice: real('shipping_price').notNull().default(0), enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true) });
export const expenses = sqliteTable('expenses', { id: integer('id').primaryKey({ autoIncrement: true }), category: text('category').notNull(), amount: real('amount').notNull(), expenseDate: text('expense_date').notNull(), notes: text('notes') });
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull(), updatedAt: text('updated_at').notNull() });

export const inventoryBatches = sqliteTable('inventory_batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  batchNumber: text('batch_number').notNull(),
  productionDate: text('production_date'), expiryDate: text('expiry_date'),
  receivedQuantity: integer('received_quantity').notNull(), remainingQuantity: integer('remaining_quantity').notNull(),
  unitCost: real('unit_cost').notNull(), receivedAt: text('received_at').notNull(),
});

export const inventoryMovements = sqliteTable('inventory_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  batchId: integer('batch_id').references(() => inventoryBatches.id),
  type: text('type').notNull(), quantity: integer('quantity').notNull(),
  referenceType: text('reference_type'), referenceId: integer('reference_id'), notes: text('notes'), createdAt: text('created_at').notNull(),
});
