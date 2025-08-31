// backend/middleware/validation.js
import Joi from 'joi';

// Common validation schemas
export const schemas = {
  employee_id: Joi.number().integer().positive(),
  store_id: Joi.number().integer().positive(),
  role_id: Joi.number().integer().min(1).max(10),
  email: Joi.string().email(),
  name: Joi.string().min(1).max(100).trim(),
  password: Joi.string().min(6).max(128),
  date: Joi.date().iso(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }
};

// Table and field whitelists for security
export const ALLOWED_TABLES = {
  'employee': {
    select: ['employee_id', 'first_name', 'last_name', 'email', 'role_id', 'store_id', 'created_at'],
    filter: ['employee_id', 'store_id', 'role_id']
  },
  'roles': {
    select: ['role_id', 'role_name', 'description'],
    filter: ['role_id']
  },
  'stores': {
    select: ['store_id', 'store_name', 'address', 'timezone'],
    filter: ['store_id']
  },
  'store_schedule': {
    select: ['schedule_id', 'store_id', 'employee_id', 'start_time', 'end_time', 'created_at'],
    filter: ['store_id', 'employee_id', 'schedule_id']
  }
};

export const ALLOWED_OPERATORS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'like'];

// Validation middleware factory
export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

// Query parameter validation
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Query validation failed',
        details: errors
      });
    }

    req.query = value;
    next();
  };
};

// Table access validation
export const validateTableAccess = (req, res, next) => {
  const { table } = req.params;
  
  if (!ALLOWED_TABLES[table]) {
    return res.status(400).json({ 
      error: 'Invalid table',
      allowed_tables: Object.keys(ALLOWED_TABLES)
    });
  }

  req.tableConfig = ALLOWED_TABLES[table];
  next();
};

// Field validation for dynamic queries
export const validateFields = (fields, allowedFields) => {
  const invalidFields = fields.filter(field => !allowedFields.includes(field));
  return invalidFields.length === 0 ? null : invalidFields;
};

// Specific validation schemas
export const validationSchemas = {
  login: Joi.object({
    employeeId: Joi.string().length(7).pattern(/^\d+$/).required(),
    password: Joi.string().required()
  }),

  createEmployee: Joi.object({
    first_name: schemas.name.required(),
    last_name: schemas.name.required(),
    email: schemas.email.required(),
    role_id: schemas.role_id.required(),
    store_id: schemas.store_id.required()
  }),

  updateEmployee: Joi.object({
    first_name: schemas.name,
    last_name: schemas.name,
    email: schemas.email,
    role_id: schemas.role_id,
    store_id: schemas.store_id
  }).min(1),

  dropdownQuery: Joi.object({
    table: Joi.string().valid(...Object.keys(ALLOWED_TABLES)).required(),
    valueField: Joi.string().required(),
    displayField: Joi.string().required(),
    filterField: Joi.string().optional(),
    filterValue: Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number()))
    ).optional(),
    filterOperator: Joi.string().valid(...ALLOWED_OPERATORS).default('eq')
  }),

  scheduleCreate: Joi.object({
    entries: Joi.array().items(
      Joi.object({
        employee_id: schemas.employee_id.required(),
        start_time: schemas.date.required(),
        end_time: schemas.date.required(),
        store_id: schemas.store_id.required()
      })
    ).required()
  }),

  chatRoom: Joi.object({
    participants: Joi.array().items(schemas.employee_id).min(2).required(),
    name: Joi.string().min(1).max(100).trim().optional(),
    type: Joi.string().valid('group', 'private', 'store').default('group')
  }),

  message: Joi.object({
    room_id: Joi.number().integer().positive().required(),
    content: Joi.string().min(1).max(1000).required()
  })
};

