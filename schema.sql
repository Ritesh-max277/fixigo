-- Rokade Electrical Service Platform - Database Schema
-- Optimized for a 3-role marketplace (Customer, Electrician, Admin)

-- 1. Users Table (Base table for authentication and shared data)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL, -- 'user' (customer), 'electrician', 'admin'
  name TEXT NOT NULL,
  mobile TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Profile
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  pincode TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 3. Electricians Profile
CREATE TABLE IF NOT EXISTS electricians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  area TEXT,
  skills TEXT,
  experience TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 4. Admins Profile
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  last_password_change DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 5. Services Catalog
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price_range TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  electrician_id INTEGER,
  service_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  problem_description TEXT,
  problem_photo TEXT,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  status TEXT DEFAULT 'Pending', -- 'Pending', 'Assigned', 'In Progress', 'Completed'
  total_amount INTEGER DEFAULT 0,
  electrician_earning INTEGER DEFAULT 0,
  platform_commission INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users (id),
  FOREIGN KEY (electrician_id) REFERENCES electricians (id),
  FOREIGN KEY (service_id) REFERENCES services (id)
);

-- 7. Payments
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  payment_method TEXT, -- 'UPI', 'Cash', 'Online'
  payment_status TEXT DEFAULT 'Pending', -- 'Pending', 'Completed'
  who_collected_payment TEXT, -- 'Electrician', 'Platform'
  commission_amount INTEGER DEFAULT 0,
  electrician_pay INTEGER DEFAULT 0,
  payment_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings (id)
);

-- 8. Admin Logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users (id)
);
