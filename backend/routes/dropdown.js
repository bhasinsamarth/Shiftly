// backend/routes/dropdown.js
import express from 'express';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateQuery, ALLOWED_TABLES, validateFields } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Secure dropdown options endpoint
router.get('/:table',
  authenticateToken,
  validateQuery(Joi.object({
    valueField: Joi.string().required(),
    displayField: Joi.string().required(),
    filterField: Joi.string().optional(),
    filterValue: Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number()))
    ).optional(),
    filterOperator: Joi.string().valid('eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in').default('eq')
  })),
  async (req, res) => {
    try {
      const { table } = req.params;
      const { valueField, displayField, filterField, filterValue, filterOperator } = req.query;

      // Validate table access
      if (!ALLOWED_TABLES[table]) {
        return res.status(400).json({ 
          error: 'Invalid table',
          allowed_tables: Object.keys(ALLOWED_TABLES)
        });
      }

      const tableConfig = ALLOWED_TABLES[table];

      // Validate fields
      const requestedFields = [valueField, displayField];
      if (filterField) requestedFields.push(filterField);

      const invalidFields = validateFields(requestedFields, tableConfig.select);
      if (invalidFields) {
        return res.status(400).json({
          error: 'Invalid fields',
          invalid_fields: invalidFields,
          allowed_fields: tableConfig.select
        });
      }

      // Build query
      const selectFields = [valueField, displayField];
      const filters = {};

      // Add store-level filtering for relevant tables
      if (table === 'employee' && ![1, 2].includes(req.user.role_id)) {
        filters.store_id = { value: req.user.store_id };
      }

      // Add custom filter if provided
      if (filterField && filterValue !== undefined) {
        // Validate filter field
        if (!tableConfig.filter.includes(filterField)) {
          return res.status(400).json({
            error: 'Invalid filter field',
            field: filterField,
            allowed_filter_fields: tableConfig.filter
          });
        }

        filters[filterField] = {
          value: filterValue,
          operator: filterOperator
        };
      }

      const options = await db.safeSelect(
        table,
        selectFields,
        filters,
        {
          orderBy: { field: displayField, ascending: true }
        }
      );

      res.json(options);
    } catch (error) {
      console.error('Dropdown options error:', error);
      res.status(500).json({ error: 'Failed to fetch options' });
    }
  }
);

// Predefined dropdown endpoints for common use cases
router.get('/roles/all', authenticateToken, async (req, res) => {
  try {
    const roles = await db.safeSelect(
      'roles',
      ['role_id', 'role_name', 'description'],
      {},
      { orderBy: { field: 'role_name', ascending: true } }
    );

    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

router.get('/stores/all', authenticateToken, async (req, res) => {
  try {
    const isAdmin = [1, 2].includes(req.user.role_id);
    const filters = {};

    // Non-admins can only see their own store
    if (!isAdmin) {
      filters.store_id = { value: req.user.store_id };
    }

    const stores = await db.safeSelect(
      'stores',
      ['store_id', 'store_name', 'address'],
      filters,
      { orderBy: { field: 'store_name', ascending: true } }
    );

    res.json(stores);
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

export default router;

