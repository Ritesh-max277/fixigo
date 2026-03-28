import express from "express";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcrypt";
import { supabase } from "./src/supabase";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to log admin actions
  const logAdminAction = async (adminId: number, action: string, details: string) => {
    if (adminId) {
      await supabase.from('admin_logs').insert([{ admin_id: adminId, action, details }]);
    }
  };

  // --- API Routes ---

  // Auth: Signup (Customer)
  app.post("/api/auth/signup", async (req, res) => {
    const { name, mobile, email, password, address, city, pincode } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert([{ name, mobile, email, password_hash: hashedPassword, role: 'user' }])
        .select()
        .single();

      if (userError) throw userError;

      await supabase
        .from('customers')
        .insert([{ user_id: user.id, address, city, pincode }]);

      res.json({ success: true, userId: user.id, role: 'user' });
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation in Postgres
        res.status(400).json({ error: "Mobile number already registered" });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Auth: Register Electrician
  app.post("/api/auth/register-electrician", async (req, res) => {
    const { name, mobile, email, password, area, skills, experience, category } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert([{ name, mobile, email, password_hash: hashedPassword, role: 'electrician' }])
        .select()
        .single();

      if (userError) throw userError;

      await supabase
        .from('electricians')
        .insert([{ user_id: user.id, area, skills, experience, category: category || 'Electrician' }]);

      res.json({ success: true });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(400).json({ error: "Mobile number already registered" });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { mobile, password } = req.body;
      
      const cleanMobile = mobile?.trim();
      const cleanPassword = password?.trim();

      // Hardcoded admin bypass for specific numbers or password
      if (cleanPassword === 'mayuri8010') {
        try {
          const { data: adminUser } = await supabase.from('users').select('*').eq('role', 'admin').limit(1).single();
          const adminId = adminUser ? adminUser.id : 1;
          return res.json({ success: true, user: { id: adminId, name: 'Admin', mobile: cleanMobile || '8010733617', role: 'admin' } });
        } catch (e) {
          return res.json({ success: true, user: { id: 1, name: 'Admin', mobile: cleanMobile || '8010733617', role: 'admin' } });
        }
      }

      if (!cleanMobile || !cleanPassword) {
        return res.status(400).json({ error: "Mobile and password are required" });
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('mobile', cleanMobile)
        .single();
      
      if (user && user.password_hash && await bcrypt.compare(cleanPassword, user.password_hash)) {
        let extraData = {};
        if (user.role === 'electrician') {
          const { data: electrician } = await supabase
            .from('electricians')
            .select('*')
            .eq('user_id', user.id)
            .single();
            
          if (electrician) {
            if (electrician.status !== 'approved') {
               return res.status(403).json({ error: "Account pending approval" });
            }
            extraData = { electricianId: electrician.id };
          }
        }
        res.json({ success: true, user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role, ...extraData } });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error during login" });
    }
  });

  // Services: Get All
  app.get("/api/services", async (req, res) => {
    try {
      const { data: services, error } = await supabase.from('services').select('*').eq('is_active', 1);
      if (error) throw error;
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  // Admin Services: Get All (including inactive)
  app.get("/api/admin/services", async (req, res) => {
    try {
      const { data: services, error } = await supabase.from('services').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.json(services);
    } catch (error) {
      console.error("Error fetching admin services:", error);
      res.status(500).json({ error: "Failed to fetch admin services" });
    }
  });

  // Admin Services: Add New
  app.post("/api/admin/services", async (req, res) => {
    const { name, description, price_range, category, adminId } = req.body;
    try {
      const { data, error } = await supabase
        .from('services')
        .insert([{ name, description, price_range, category: category || 'Electrician' }])
        .select()
        .single();
        
      if (error) throw error;
      await logAdminAction(adminId, 'ADD_SERVICE', `Added new service: ${name}`);
      res.json({ success: true, id: data.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to add service" });
    }
  });

  // Admin Services: Toggle Active
  app.put("/api/admin/services/:id/toggle", async (req, res) => {
    const { is_active, adminId } = req.body;
    try {
      await supabase.from('services').update({ is_active: is_active ? 1 : 0 }).eq('id', req.params.id);
      await logAdminAction(adminId, 'TOGGLE_SERVICE', `Toggled service #${req.params.id} to ${is_active ? 'Active' : 'Inactive'}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle service" });
    }
  });

  // Bookings: Create
  app.post("/api/bookings", async (req, res) => {
    const { userId, name, mobile, serviceId, address, problem, date, time, serviceMode, itemName, latitude, longitude, photo } = req.body;
    try {
      let customerId = userId;
      
      // If no userId is provided, find or create the user based on mobile number
      if (!customerId && mobile) {
        const { data: existingUser } = await supabase.from('users').select('id').eq('mobile', mobile).single();
        if (existingUser) {
          customerId = existingUser.id;
        } else {
          const { data: newUser, error: createUserError } = await supabase.from('users').insert([{
            name: name || 'Guest User',
            mobile: mobile,
            role: 'user',
            password_hash: 'guest' // Dummy password hash
          }]).select().single();
          
          if (createUserError) throw createUserError;
          customerId = newUser.id;
        }
      }

      const { error } = await supabase.from('bookings').insert([{
        customer_id: customerId,
        service_id: serviceId,
        address,
        problem_description: problem,
        problem_photo: photo || null,
        booking_date: date,
        booking_time: time,
        service_mode: serviceMode || 'home',
        item_name: itemName || null,
        item_status: serviceMode === 'pickup' ? 'Requested' : null,
        latitude: latitude || null,
        longitude: longitude || null
      }]);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // Bookings: Get User Bookings
  app.get("/api/bookings/user/:userId", async (req, res) => {
    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, services(name), payments(payment_status)')
        .eq('customer_id', req.params.userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = bookings.map((b: any) => ({
        ...b,
        service_type: b.services?.name,
        payment_status: b.payments?.[0]?.payment_status || 'Pending',
        problem: b.problem_description,
        date: b.booking_date,
        time: b.booking_time,
        total_price: b.total_amount
      }));
      res.json(mapped);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch user bookings" });
    }
  });

  // Bookings: Get All (Admin)
  app.get("/api/bookings/admin", async (req, res) => {
    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, services(name), users!customer_id(name, mobile)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = bookings.map((b: any) => ({
        ...b,
        service_type: b.services?.name,
        name: b.users?.name,
        mobile: b.users?.mobile,
        problem: b.problem_description,
        date: b.booking_date,
        time: b.booking_time,
        total_price: b.total_amount
      }));
      res.json(mapped);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch admin bookings" });
    }
  });

  // Bookings: Update Charges
  app.put("/api/bookings/:id/charges", async (req, res) => {
    const { pickupCharge, deliveryCharge, adminId } = req.body;
    const { id } = req.params;
    try {
      await supabase.from('bookings').update({ pickup_charge: pickupCharge, delivery_charge: deliveryCharge }).eq('id', id);
      await logAdminAction(adminId, 'UPDATE_CHARGES', `Updated charges for booking #${id}: Pickup ₹${pickupCharge}, Delivery ₹${deliveryCharge}`);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update charges" });
    }
  });

  // Bookings: Update Item Status
  app.put("/api/bookings/:id/item-status", async (req, res) => {
    const { itemStatus, pickupDate, deliveryDate, adminId } = req.body;
    const { id } = req.params;
    try {
      const updates: any = { item_status: itemStatus };
      if (pickupDate !== undefined) updates.pickup_date = pickupDate;
      if (deliveryDate !== undefined) updates.delivery_date = deliveryDate;
      
      await supabase.from('bookings').update(updates).eq('id', id);
      await logAdminAction(adminId, 'UPDATE_ITEM_STATUS', `Updated item status for booking #${id} to ${itemStatus}`);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update item status" });
    }
  });

  // Bookings: Update Status (Admin)
  app.put("/api/bookings/:id/status", async (req, res) => {
    const { status, adminId } = req.body;
    const { id } = req.params;
    try {
      await supabase.from('bookings').update({ status }).eq('id', id);
      await logAdminAction(adminId, 'UPDATE_BOOKING_STATUS', `Updated booking #${id} to ${status}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Bookings: Assign Electrician (Admin)
  app.put("/api/bookings/:id/assign", async (req, res) => {
    const { electricianId, adminId } = req.body;
    try {
      await supabase.from('bookings').update({ electrician_id: electricianId, status: 'Assigned' }).eq('id', req.params.id);
      await logAdminAction(adminId, 'ASSIGN_ELECTRICIAN', `Assigned electrician #${electricianId} to booking #${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to assign electrician" });
    }
  });

  // Bookings: Complete & Calculate Commission
  app.put("/api/bookings/:id/complete", async (req, res) => {
    const { totalPrice, paymentCollectedBy } = req.body;
    const id = req.params.id;
    
    const platformCommission = Math.floor(totalPrice * 0.20);
    const electricianEarning = totalPrice - platformCommission;

    try {
      await supabase.from('bookings').update({
        status: 'Completed',
        total_amount: totalPrice,
        electrician_earning: electricianEarning,
        platform_commission: platformCommission
      }).eq('id', id);

      await supabase.from('payments').insert([{
        booking_id: id,
        total_amount: totalPrice,
        payment_method: 'Cash/UPI',
        payment_status: 'Pending',
        who_collected_payment: paymentCollectedBy,
        commission_amount: platformCommission,
        electrician_pay: electricianEarning
      }]);

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to complete booking" });
    }
  });

  // Payments: Mark as Paid
  app.post("/api/payments/:bookingId/paid", async (req, res) => {
    try {
      await supabase.from('payments').update({ payment_status: 'Paid' }).eq('booking_id', req.params.bookingId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update payment status" });
    }
  });

  // Electricians: Get Nearby
  app.get("/api/electricians/nearby", async (req, res) => {
    const { lat, lng, category } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and longitude required" });
    }
    
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);

    try {
      let query = supabase.from('electricians').select('*, users!inner(name, mobile, email)').eq('status', 'approved').not('latitude', 'is', null).not('longitude', 'is', null);
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data: electricians, error } = await query;
      if (error) throw error;

      // Haversine formula
      const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      };

      const nearby = electricians.map((e: any) => {
        const distance = getDistance(latitude, longitude, e.latitude, e.longitude);
        return { ...e, name: e.users?.name, mobile: e.users?.mobile, email: e.users?.email, distance };
      }).filter((e: any) => e.distance <= 10)
        .sort((a: any, b: any) => a.distance - b.distance);

      res.json(nearby);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch nearby electricians" });
    }
  });

  // Electricians: Get All (Admin)
  app.get("/api/electricians", async (req, res) => {
    try {
      const { data: electricians, error } = await supabase.from('electricians').select('*, users(name, mobile, email)');
      if (error) throw error;
      
      const mapped = electricians.map((e: any) => ({ 
        ...e, 
        name: e.users?.name, 
        mobile: e.users?.mobile, 
        email: e.users?.email,
        is_approved: e.status === 'approved' ? 1 : 0 
      }));
      res.json(mapped);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch electricians" });
    }
  });

  // Electricians: Approve
  app.put("/api/electricians/:id/approve", async (req, res) => {
    const { adminId } = req.body;
    try {
      await supabase.from('electricians').update({ status: 'approved' }).eq('id', req.params.id);
      await logAdminAction(adminId, 'APPROVE_ELECTRICIAN', `Approved electrician #${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve" });
    }
  });

  // Electricians: Update Location
  app.put("/api/electricians/:id/location", async (req, res) => {
    const { lat, lng } = req.body;
    try {
      await supabase.from('electricians').update({ latitude: lat, longitude: lng, last_updated_time: new Date().toISOString() }).eq('user_id', req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  // Users: Get All (Admin)
  app.get("/api/users", async (req, res) => {
    try {
      const { data: users, error } = await supabase.from('users').select('id, name, mobile, role, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Payments: Get All (Admin)
  app.get("/api/payments", async (req, res) => {
    try {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('*, bookings(customer_id, users!customer_id(name))')
        .order('payment_timestamp', { ascending: false });
        
      if (error) throw error;

      const mapped = payments.map((p: any) => ({ 
        ...p, 
        customer_id: p.bookings?.customer_id,
        user_name: p.bookings?.users?.name,
        amount: p.total_amount, 
        date: p.payment_timestamp, 
        status: p.payment_status 
      }));
      res.json(mapped);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Electrician: Get Dashboard Data
  app.get("/api/electrician/:id/dashboard", async (req, res) => {
    const electricianId = req.params.id;
    try {
      const { data: jobs, error } = await supabase
        .from('bookings')
        .select('*, services(name), users!customer_id(name, mobile), payments(payment_status)')
        .eq('electrician_id', electricianId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mappedJobs = jobs.map((b: any) => ({ 
        ...b, 
        service_type: b.services?.name, 
        name: b.users?.name, 
        mobile: b.users?.mobile,
        payment_status: b.payments?.[0]?.payment_status || 'Pending',
        problem: b.problem_description, 
        date: b.booking_date, 
        time: b.booking_time, 
        total_price: b.total_amount 
      }));

      const totalJobs = jobs.length;
      const totalEarnings = jobs.filter(j => j.status === 'Completed').reduce((sum, j) => sum + (j.electrician_earning || 0), 0);

      res.json({ jobs: mappedJobs, stats: { total_jobs: totalJobs, total_earnings: totalEarnings } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Admin: Commission Report
  app.get("/api/admin/commissions", async (req, res) => {
    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, electricians(users(name)), users!customer_id(name), payments(who_collected_payment)')
        .eq('status', 'Completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const report = bookings.map((b: any) => ({
        id: b.id,
        customer_name: b.users?.name,
        electrician_name: b.electricians?.users?.name,
        total_price: b.total_amount,
        electrician_earning: b.electrician_earning,
        platform_commission: b.platform_commission,
        payment_collected_by: b.payments?.[0]?.who_collected_payment,
        date: b.created_at
      }));
      
      const totalRevenue = report.reduce((sum, r) => sum + (r.total_price || 0), 0);
      const totalCommission = report.reduce((sum, r) => sum + (r.platform_commission || 0), 0);
      const totalPayout = report.reduce((sum, r) => sum + (r.electrician_earning || 0), 0);

      res.json({ report, stats: { total_revenue: totalRevenue, total_commission: totalCommission, total_payout: totalPayout } });
    } catch (error) {
      console.error("Error fetching commissions:", error);
      res.status(500).json({ error: "Failed to fetch commissions" });
    }
  });

  // Admin: Logs
  app.get("/api/admin/logs", async (req, res) => {
    try {
      const { data: logs, error } = await supabase
        .from('admin_logs')
        .select('*, users!admin_id(name)')
        .order('timestamp', { ascending: false });
        
      if (error) throw error;
      
      const mapped = logs.map((l: any) => ({ ...l, admin_name: l.users?.name }));
      res.json(mapped);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // Admin: Delete User
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { adminId } = req.body;
      
      const { data: user } = await supabase.from('users').select('name, role').eq('id', id).single();
      if (!user) return res.status(404).json({ error: "User not found" });

      await supabase.from('users').delete().eq('id', id);
      await logAdminAction(adminId, 'DELETE_USER', `Deleted ${user.role}: ${user.name}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Admin: Delete Electrician
  app.delete("/api/admin/electricians/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { adminId } = req.body;
      
      const { data: electrician } = await supabase.from('electricians').select('user_id, users(name)').eq('id', id).single() as any;
      if (!electrician) return res.status(404).json({ error: "Electrician not found" });

      // Deleting the user will cascade and delete the electrician record
      await supabase.from('users').delete().eq('id', electrician.user_id);
      await logAdminAction(adminId, 'DELETE_ELECTRICIAN', `Deleted electrician: ${electrician.users?.name || 'Unknown'}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting electrician:", error);
      res.status(500).json({ error: "Failed to delete electrician" });
    }
  });

  // Admin: Change Password
  app.put("/api/admin/change-password", async (req, res) => {
    try {
      const { adminId, currentPassword, newPassword } = req.body;
      
      const { data: admin } = await supabase.from('users').select('*').eq('id', adminId).eq('role', 'admin').single();
      if (!admin) return res.status(404).json({ error: "Admin not found" });

      const validPassword = await bcrypt.compare(currentPassword, admin.password_hash);
      if (!validPassword) return res.status(400).json({ error: "Incorrect current password" });

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await supabase.from('users').update({ password_hash: hashedNewPassword }).eq('id', adminId);
      
      await logAdminAction(adminId, 'CHANGE_PASSWORD', 'Admin changed their password');
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });


  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    const path = await import('path');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
