-- Supabase PostgreSQL Schema for Fixora

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. customers
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    address TEXT,
    city TEXT,
    pincode TEXT
);

-- 3. electricians
CREATE TABLE IF NOT EXISTS electricians (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    area TEXT,
    skills TEXT,
    experience TEXT,
    status TEXT DEFAULT 'pending',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    last_updated_time TIMESTAMP WITH TIME ZONE,
    category TEXT DEFAULT 'Electrician'
);

-- 4. admins
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    last_password_change TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. services
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_range TEXT,
    category TEXT DEFAULT 'Electrician',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. bookings
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES users(id),
    electrician_id INTEGER REFERENCES electricians(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    address TEXT NOT NULL,
    problem_description TEXT,
    problem_photo TEXT,
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    total_amount INTEGER DEFAULT 0,
    electrician_earning INTEGER DEFAULT 0,
    platform_commission INTEGER DEFAULT 0,
    service_mode TEXT DEFAULT 'home',
    item_name TEXT,
    item_status TEXT,
    pickup_date TEXT,
    delivery_date TEXT,
    pickup_charge INTEGER DEFAULT 0,
    delivery_charge INTEGER DEFAULT 0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    total_amount INTEGER NOT NULL,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'Pending',
    who_collected_payment TEXT,
    commission_amount INTEGER DEFAULT 0,
    electrician_pay INTEGER DEFAULT 0,
    payment_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. admin_logs
CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Admin User
INSERT INTO users (name, mobile, password_hash, role) 
VALUES ('Admin', '8010733617', '$2b$10$wY.uB4a7u/Fp7v.3tWf/z.w/9.z.z.z.z.z.z.z.z.z.z.z.z.z.z', 'admin')
ON CONFLICT (mobile) DO NOTHING;

INSERT INTO admins (user_id) 
SELECT id FROM users WHERE mobile = '8010733617'
ON CONFLICT (user_id) DO NOTHING;

-- Seed Services
INSERT INTO services (name, description, price_range, category) VALUES 
('Fan Installation', 'Ceiling, exhaust, and wall fans', '₹250 - ₹500', 'Electrician'),
('Wiring Repair', 'Fault detection and rewiring', '₹300 - ₹2000', 'Electrician'),
('Switchboard Repair', 'Fixing switches and sockets', '₹150 - ₹800', 'Electrician'),
('MCB / Fuse Repair', 'Tripping MCBs and fuses', '₹350 - ₹1500', 'Electrician'),
('Meter Installation', 'Sub-meter and main board', '₹800 - ₹3000', 'Electrician'),
('Emergency Service', '24/7 support for power failures', 'On Inspection', 'Electrician'),
('Tap Repair', 'Fixing leaking taps and faucets', '₹150 - ₹400', 'Plumber'),
('Pipe Leakage', 'Detecting and fixing pipe leaks', '₹300 - ₹1500', 'Plumber'),
('Water Tank Cleaning', 'Deep cleaning of water tanks', '₹500 - ₹2000', 'Plumber'),
('Interior Painting', 'Wall painting for rooms', '₹2000 - ₹10000', 'Painter'),
('Exterior Painting', 'Weatherproof exterior painting', '₹5000 - ₹25000', 'Painter');
