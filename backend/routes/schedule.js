// backend/routes/schedule.js
import express from 'express';
import { db } from '../config/database.js';
import { authenticateToken, requireRole, requireOwnership } from '../middleware/auth.js';
import { validate, validateQuery, schemas } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Get schedule for a store/employee
router.get('/',
  authenticateToken,
  validateQuery(Joi.object({
    store_id: schemas.store_id.optional(),
    employee_id: schemas.employee_id.optional(),
    start_date: schemas.date.optional(),
    end_date: schemas.date.optional(),
    page: schemas.pagination.page,
    limit: schemas.pagination.limit
  })),
  async (req, res) => {
    try {
      const { store_id, employee_id, start_date, end_date, page, limit } = req.query;
      const isAdmin = [1, 2].includes(req.user.role_id);

      const filters = {};

      // Store filtering
      if (!isAdmin || store_id) {
        filters.store_id = { value: store_id || req.user.store_id };
      }

      // Employee filtering
      if (employee_id) {
        // Check if user can access this employee's schedule
        if (!isAdmin && parseInt(employee_id) !== req.user.employee_id) {
          return res.status(403).json({ error: 'Access denied: cannot view other employee schedules' });
        }
        filters.employee_id = { value: parseInt(employee_id) };
      }

      // Date range filtering
      if (start_date) {
        filters.start_time = { value: start_date, operator: 'gte' };
      }
      if (end_date) {
        filters.end_time = { value: end_date, operator: 'lte' };
      }

      const schedule = await db.safeSelect(
        'store_schedule',
        ['schedule_id', 'store_id', 'employee_id', 'start_time', 'end_time', 'created_at'],
        filters,
        {
          pagination: { page, limit },
          orderBy: { field: 'start_time', ascending: true }
        }
      );

      res.json(schedule);
    } catch (error) {
      console.error('Get schedule error:', error);
      res.status(500).json({ error: 'Failed to fetch schedule' });
    }
  }
);

// Create schedule entries (batch insert)
router.post('/',
  authenticateToken,
  requireRole([1, 2]), // Admin or Owner only
  validate(Joi.object({
    entries: Joi.array().items(
      Joi.object({
        employee_id: schemas.employee_id.required(),
        start_time: schemas.date.required(),
        end_time: schemas.date.required(),
        store_id: schemas.store_id.optional()
      })
    ).min(1).required()
  })),
  async (req, res) => {
    try {
      const { entries } = req.body;

      // Add store_id to entries if not provided (use user's store)
      const scheduleEntries = entries.map(entry => ({
        ...entry,
        store_id: entry.store_id || req.user.store_id
      }));

      // Validate that all entries are for stores the user has access to
      const isAdmin = [1, 2].includes(req.user.role_id);
      if (!isAdmin) {
        const invalidEntries = scheduleEntries.filter(entry => entry.store_id !== req.user.store_id);
        if (invalidEntries.length > 0) {
          return res.status(403).json({ error: 'Cannot create schedule for other stores' });
        }
      }

      // Validate employees exist and belong to the correct store
      const employeeIds = [...new Set(scheduleEntries.map(entry => entry.employee_id))];
      const employees = await db.safeSelect(
        'employee',
        ['employee_id', 'store_id'],
        { employee_id: { value: employeeIds, operator: 'in' } }
      );

      for (const entry of scheduleEntries) {
        const employee = employees.find(emp => emp.employee_id === entry.employee_id);
        if (!employee) {
          return res.status(400).json({ 
            error: `Employee ${entry.employee_id} not found` 
          });
        }
        if (employee.store_id !== entry.store_id) {
          return res.status(400).json({ 
            error: `Employee ${entry.employee_id} does not belong to store ${entry.store_id}` 
          });
        }
      }

      // Validate time ranges
      for (const entry of scheduleEntries) {
        const startTime = new Date(entry.start_time);
        const endTime = new Date(entry.end_time);
        
        if (startTime >= endTime) {
          return res.status(400).json({ 
            error: 'End time must be after start time',
            entry: entry
          });
        }
      }

      const createdEntries = await db.safeInsert('store_schedule', scheduleEntries);

      res.status(201).json({
        message: 'Schedule entries created successfully',
        entries: createdEntries,
        count: createdEntries.length
      });
    } catch (error) {
      console.error('Create schedule error:', error);
      res.status(500).json({ error: 'Failed to create schedule entries' });
    }
  }
);

// Update schedule entry
router.put('/:schedule_id',
  authenticateToken,
  requireRole([1, 2]), // Admin or Owner only
  validate(Joi.object({
    start_time: schemas.date.optional(),
    end_time: schemas.date.optional(),
    employee_id: schemas.employee_id.optional()
  }).min(1)),
  async (req, res) => {
    try {
      const { schedule_id } = req.params;
      const updates = req.body;

      // Get existing schedule entry
      const existingEntries = await db.safeSelect(
        'store_schedule',
        ['schedule_id', 'store_id', 'employee_id', 'start_time', 'end_time'],
        { schedule_id: { value: parseInt(schedule_id) } }
      );

      if (!existingEntries || existingEntries.length === 0) {
        return res.status(404).json({ error: 'Schedule entry not found' });
      }

      const existingEntry = existingEntries[0];

      // Check store access
      const isAdmin = [1, 2].includes(req.user.role_id);
      if (!isAdmin && existingEntry.store_id !== req.user.store_id) {
        return res.status(403).json({ error: 'Access denied: different store' });
      }

      // Validate time range if both times are provided
      if (updates.start_time && updates.end_time) {
        const startTime = new Date(updates.start_time);
        const endTime = new Date(updates.end_time);
        
        if (startTime >= endTime) {
          return res.status(400).json({ error: 'End time must be after start time' });
        }
      }

      const updatedEntry = await db.safeUpdate(
        'store_schedule',
        updates,
        { schedule_id: parseInt(schedule_id) }
      );

      res.json({
        message: 'Schedule entry updated successfully',
        entry: updatedEntry[0]
      });
    } catch (error) {
      console.error('Update schedule error:', error);
      res.status(500).json({ error: 'Failed to update schedule entry' });
    }
  }
);

// Delete schedule entry
router.delete('/:schedule_id',
  authenticateToken,
  requireRole([1, 2]), // Admin or Owner only
  async (req, res) => {
    try {
      const { schedule_id } = req.params;

      // Get existing schedule entry to check permissions
      const existingEntries = await db.safeSelect(
        'store_schedule',
        ['schedule_id', 'store_id'],
        { schedule_id: { value: parseInt(schedule_id) } }
      );

      if (!existingEntries || existingEntries.length === 0) {
        return res.status(404).json({ error: 'Schedule entry not found' });
      }

      const existingEntry = existingEntries[0];

      // Check store access
      const isAdmin = [1, 2].includes(req.user.role_id);
      if (!isAdmin && existingEntry.store_id !== req.user.store_id) {
        return res.status(403).json({ error: 'Access denied: different store' });
      }

      await db.safeDelete('store_schedule', { schedule_id: parseInt(schedule_id) });

      res.json({ message: 'Schedule entry deleted successfully' });
    } catch (error) {
      console.error('Delete schedule error:', error);
      res.status(500).json({ error: 'Failed to delete schedule entry' });
    }
  }
);

// Get time card data
router.get('/timecard',
  authenticateToken,
  validateQuery(Joi.object({
    store_id: schemas.store_id.optional(),
    employee_id: schemas.employee_id.optional(),
    date: schemas.date.required()
  })),
  async (req, res) => {
    try {
      const { store_id, employee_id, date } = req.query;
      const isAdmin = [1, 2].includes(req.user.role_id);

      const filters = {};

      // Store filtering
      if (!isAdmin || store_id) {
        filters.store_id = { value: store_id || req.user.store_id };
      }

      // Employee filtering
      if (employee_id) {
        if (!isAdmin && parseInt(employee_id) !== req.user.employee_id) {
          return res.status(403).json({ error: 'Access denied: cannot view other employee time cards' });
        }
        filters.employee_id = { value: parseInt(employee_id) };
      }

      const schedule = await db.safeSelect(
        'store_schedule',
        ['employee_id', 'time_log'],
        filters
      );

      res.json(schedule);
    } catch (error) {
      console.error('Get timecard error:', error);
      res.status(500).json({ error: 'Failed to fetch timecard data' });
    }
  }
);

export default router;

