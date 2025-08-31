// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import { supabase } from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify the Supabase JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Fetch employee data from database
    const { data: employee, error: dbError } = await supabase
      .from('employee')
      .select('employee_id, email, first_name, last_name, role_id, store_id')
      .eq('email', user.email)
      .single();

    if (dbError || !employee) {
      return res.status(403).json({ error: 'Employee not found' });
    }

    // Add user info to request object
    req.user = {
      ...user,
      employee_id: employee.employee_id,
      role_id: employee.role_id,
      store_id: employee.store_id,
      first_name: employee.first_name,
      last_name: employee.last_name
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ error: 'Token verification failed' });
  }
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role_id)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required_roles: allowedRoles,
        user_role: req.user.role_id
      });
    }

    next();
  };
};

export const requireOwnership = (resourceField) => {
  return (req, res, next) => {
    const resourceId = req.params[resourceField] || req.body[resourceField];
    
    if (!resourceId) {
      return res.status(400).json({ error: `Missing ${resourceField}` });
    }

    // For store-level resources, check store ownership
    if (resourceField === 'store_id' && req.user.store_id !== parseInt(resourceId)) {
      return res.status(403).json({ error: 'Access denied: different store' });
    }

    // For employee-level resources, check employee ownership or admin role
    if (resourceField === 'employee_id') {
      const isOwnResource = req.user.employee_id === parseInt(resourceId);
      const isAdmin = [1, 2].includes(req.user.role_id); // Admin or Owner
      
      if (!isOwnResource && !isAdmin) {
        return res.status(403).json({ error: 'Access denied: not your resource' });
      }
    }

    next();
  };
};

