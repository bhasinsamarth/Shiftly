// backend/routes/auth.js
import express from 'express';
import { supabase } from '../config/database.js';
import { validate, validationSchemas } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Login endpoint - validates employee ID and returns employee data
router.post('/login', validate(validationSchemas.login), async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    // 1. Lookup employee by employee_id
    const { data: employee, error: dbError } = await supabase
      .from('employee')
      .select('employee_id, email, first_name, last_name, role_id, store_id')
      .eq('employee_id', employeeId)
      .single();

    if (dbError || !employee) {
      return res.status(401).json({ error: 'Invalid employee ID or password' });
    }

    // 2. Attempt Supabase auth login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: employee.email,
      password: password
    });

    if (authError) {
      return res.status(401).json({ error: 'Invalid employee ID or password' });
    }

    // 3. Return employee data with auth token
    res.json({
      user: authData.user,
      session: authData.session,
      employee: {
        employee_id: employee.employee_id,
        email: employee.email,
        first_name: employee.first_name,
        last_name: employee.last_name,
        role_id: employee.role_id,
        store_id: employee.store_id
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // Get additional employee details
    const { data: employee, error } = await supabase
      .from('employee')
      .select(`
        employee_id,
        first_name,
        last_name,
        email,
        role_id,
        store_id,
        created_at,
        roles:role_id (role_name, description),
        stores:store_id (store_name, address, timezone)
      `)
      .eq('employee_id', req.user.employee_id)
      .single();

    if (error) {
      throw error;
    }

    res.json(employee);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Password reset request
router.post('/forgot-password', async (req, res) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId || employeeId.length !== 7 || !/^\d+$/.test(employeeId)) {
      return res.status(400).json({ error: 'Valid employee ID required' });
    }

    // Get employee email
    const { data: employee, error: dbError } = await supabase
      .from('employee')
      .select('email')
      .eq('employee_id', employeeId)
      .single();

    if (dbError || !employee) {
      // Don't reveal if employee exists or not
      return res.json({ message: 'If the employee ID exists, a reset link will be sent' });
    }

    // Send password reset email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(employee.email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });

    if (resetError) {
      console.error('Password reset error:', resetError);
    }

    res.json({ message: 'If the employee ID exists, a reset link will be sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

