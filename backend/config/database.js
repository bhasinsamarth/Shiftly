// backend/config/database.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// Create Supabase client with service role key for backend operations
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Database query helper with error handling
export class DatabaseService {
  constructor(client = supabase) {
    this.client = client;
  }

  async executeQuery(operation) {
    try {
      const result = await operation;
      
      if (result.error) {
        console.error('Database error:', result.error);
        throw new Error(`Database operation failed: ${result.error.message}`);
      }

      return result.data;
    } catch (error) {
      console.error('Database service error:', error);
      throw error;
    }
  }

  // Safe select with field validation
  async safeSelect(table, fields, filters = {}, options = {}) {
    let query = this.client.from(table).select(fields.join(', '));

    // Apply filters
    Object.entries(filters).forEach(([field, { value, operator = 'eq' }]) => {
      switch (operator) {
        case 'eq':
          query = query.eq(field, value);
          break;
        case 'neq':
          query = query.neq(field, value);
          break;
        case 'gt':
          query = query.gt(field, value);
          break;
        case 'lt':
          query = query.lt(field, value);
          break;
        case 'gte':
          query = query.gte(field, value);
          break;
        case 'lte':
          query = query.lte(field, value);
          break;
        case 'in':
          query = query.in(field, value);
          break;
        case 'like':
          query = query.ilike(field, `%${value}%`);
          break;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }
    });

    // Apply ordering
    if (options.orderBy) {
      const { field, ascending = true } = options.orderBy;
      query = query.order(field, { ascending });
    }

    // Apply pagination
    if (options.pagination) {
      const { page, limit } = options.pagination;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    return this.executeQuery(query);
  }

  // Safe insert
  async safeInsert(table, data) {
    const query = this.client.from(table).insert(data).select();
    return this.executeQuery(query);
  }

  // Safe update
  async safeUpdate(table, data, filters) {
    let query = this.client.from(table).update(data);

    Object.entries(filters).forEach(([field, value]) => {
      query = query.eq(field, value);
    });

    query = query.select();
    return this.executeQuery(query);
  }

  // Safe delete
  async safeDelete(table, filters) {
    let query = this.client.from(table).delete();

    Object.entries(filters).forEach(([field, value]) => {
      query = query.eq(field, value);
    });

    return this.executeQuery(query);
  }
}

export const db = new DatabaseService();

