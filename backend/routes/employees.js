// backend/routes/employees.js
import express from 'express';
import { db } from '../config/database.js';
import { authenticateToken, requireRole, requireOwnership } from '../middleware/auth.js';
import { validate, validateQuery, validationSchemas, schemas } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Get employees (with store filtering and role-based access)
router.get('/', 
  authenticateToken,
  validateQuery(Joi.object({
    store_id: schemas.store_id.optional(),
    role_id: schemas.role_id.optional(),
    page: schemas.pagination.page,
    limit: schemas.pagination.limit,
    search: Joi.string().max(100).optional()
  })),
  async (req, res) => {
    try {
      const { store_id, role_id, page, limit, search } = req.query;
      const isAdmin = [1, 2].includes(req.user.role_id);

      // Build filters
      const filters = {};

      // Non-admins can only see employees from their own store
      if (!isAdmin || store_id) {
        filters.store_id = { value: store_id || req.user.store_id };
      }

      if (role_id) {
        filters.role_id = { value: role_id };
      }

      // Search functionality
      if (search) {
        // For search, we'll need a more complex query
        const searchQuery = `%${search}%`;
        const { data: employees, error } = await db.client
          .from('employee')
          .select(`
            employee_id,
            first_name,
            last_name,
            email,
            role_id,
            store_id,
            created_at,
            roles:role_id (role_name),
            stores:store_id (store_name)
          `)
          .or(`first_name.ilike.${searchQuery},last_name.ilike.${searchQuery},email.ilike.${searchQuery}`)
          .eq('store_id', store_id || req.user.store_id)
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;
        return res.json(employees);
      }

      // Regular query without search
      const employees = await db.safeSelect(
        'employee',
        ['employee_id', 'first_name', 'last_name', 'email', 'role_id', 'store_id', 'created_at'],
        filters,
        {
          pagination: { page, limit },
          orderBy: { field: 'created_at', ascending: false }
        }
      );

      res.json(employees);
    } catch (error) {
      console.error('Get employees error:', error);
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  }
);

// Get single employee
router.get('/:employee_id',
  authenticateToken,
  requireOwnership('employee_id'),
  async (req, res) => {
    try {
      const { employee_id } = req.params;

      const employees = await db.safeSelect(
        'employee',
        ['employee_id', 'first_name', 'last_name', 'email', 'role_id', 'store_id', 'created_at'],
        { employee_id: { value: parseInt(employee_id) } }
      );

      if (!employees || employees.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      res.json(employees[0]);
    } catch (error) {
      console.error('Get employee error:', error);
      res.status(500).json({ error: 'Failed to fetch employee' });
    }
  }
);

// Create new employee (admin/owner only)
router.post('/',
  authenticateToken,
  requireRole([1, 2]), // Admin or Owner only
  validate(validationSchemas.createEmployee),
  async (req, res) => {
    try {
      const employeeData = req.body;

      // Generate 7-digit employee ID
      let employeeId;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        employeeId = Math.floor(1000000 + Math.random() * 9000000);
        attempts++;

        if (attempts >= maxAttempts) {
          return res.status(500).json({ error: 'Failed to generate unique employee ID' });
        }

        // Check if employee ID already exists
        const existing = await db.safeSelect(
          'employee',
          ['employee_id'],
          { employee_id: { value: employeeId } }
        );

        if (!existing || existing.length === 0) {
          break;
        }
      } while (true);

      // Create employee record
      const newEmployee = await db.safeInsert('employee', {
        employee_id: employeeId,
        ...employeeData
      });

      res.status(201).json({
        message: 'Employee created successfully',
        employee: newEmployee[0],
        employee_id: employeeId
      });
    } catch (error) {
      console.error('Create employee error:', error);
      res.status(500).json({ error: 'Failed to create employee' });
    }
  }
);

// Update employee
router.put('/:employee_id',
  authenticateToken,
  requireOwnership('employee_id'),
  validate(validationSchemas.updateEmployee),
  async (req, res) => {
    try {
      const { employee_id } = req.params;
      const updates = req.body;

      const updatedEmployee = await db.safeUpdate(
        'employee',
        updates,
        { employee_id: parseInt(employee_id) }
      );

      if (!updatedEmployee || updatedEmployee.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      res.json({
        message: 'Employee updated successfully',
        employee: updatedEmployee[0]
      });
    } catch (error) {
      console.error('Update employee error:', error);
      res.status(500).json({ error: 'Failed to update employee' });
    }
  }
);

// Delete employee (admin/owner only)
router.delete('/:employee_id',
  authenticateToken,
  requireRole([1, 2]), // Admin or Owner only
  async (req, res) => {
    try {
      const { employee_id } = req.params;

      // Prevent self-deletion
      if (parseInt(employee_id) === req.user.employee_id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      await db.safeDelete('employee', { employee_id: parseInt(employee_id) });

      res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
      console.error('Delete employee error:', error);
      res.status(500).json({ error: 'Failed to delete employee' });
    }
  }
);

export default router;

