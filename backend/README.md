# Shiftly Backend API

A secure, professional backend API for the Shiftly employee management system.

## Features

- 🔐 **JWT Authentication** - Secure token-based authentication
- 🛡️ **Input Validation** - Comprehensive request validation with Joi
- 🚨 **Rate Limiting** - Protection against abuse and DDoS
- 🔒 **Role-Based Access Control** - Fine-grained permissions
- 📊 **Database Security** - Parameterized queries and field whitelisting
- 🚀 **RESTful API** - Clean, organized endpoint structure

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Copy the environment variables from your existing `.env` file or create one with:
   ```bash
   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Frontend URL for CORS
   FRONTEND_URL=http://localhost:5173

   # Email Configuration (Mailjet)
   MAILJET_API_KEY=your_mailjet_api_key
   MAILJET_API_SECRET=your_mailjet_api_secret
   EMAIL_FROM=noreply@yourcompany.com

   # Content Safety (Azure)
   CONTENT_SAFETY_ENDPOINT=your_azure_content_moderator_endpoint
   CONTENT_SAFETY_KEY=your_azure_content_moderator_key

   # Server Configuration
   NODE_ENV=development
   PORT=3001
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Production**
   ```bash
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Employee login
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/logout` - Logout
- `POST /api/auth/forgot-password` - Password reset

### Employees
- `GET /api/employees` - List employees (with filtering)
- `GET /api/employees/:id` - Get single employee
- `POST /api/employees` - Create employee (admin only)
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee (admin only)

### Dropdown Options
- `GET /api/dropdown/:table` - Get dropdown options for any table
- `GET /api/dropdown/roles/all` - Get all roles
- `GET /api/dropdown/stores/all` - Get all stores

### Schedule Management
- `GET /api/schedule` - Get schedule entries
- `POST /api/schedule` - Create schedule entries (batch)
- `PUT /api/schedule/:id` - Update schedule entry
- `DELETE /api/schedule/:id` - Delete schedule entry
- `GET /api/schedule/timecard` - Get timecard data

### Chat System
- `GET /api/chat/rooms` - Get user's chat rooms
- `POST /api/chat/rooms` - Create new chat room
- `GET /api/chat/rooms/:id/messages` - Get messages
- `POST /api/chat/rooms/:id/messages` - Send message
- `PUT /api/chat/rooms/:id` - Update room (rename)
- `DELETE /api/chat/rooms/:id` - Leave/delete room

## Security Features

### Input Validation
All endpoints use Joi schemas for comprehensive input validation:
- Type checking
- Length limits
- Format validation
- Required field enforcement

### Authentication & Authorization
- JWT token verification
- Role-based access control (Admin, Owner, Employee)
- Resource ownership validation
- Store-level data isolation

### Rate Limiting
- General API: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes
- Per-IP tracking

### Database Security
- Parameterized queries only
- Field whitelisting
- No raw SQL exposure
- Supabase service role isolation

## Architecture

```
backend/
├── config/
│   └── database.js      # Database configuration and helpers
├── middleware/
│   ├── auth.js          # Authentication middleware
│   └── validation.js    # Input validation schemas
├── routes/
│   ├── auth.js          # Authentication endpoints
│   ├── employees.js     # Employee management
│   ├── dropdown.js      # Dropdown options
│   ├── schedule.js      # Schedule management
│   └── chat.js          # Chat system
├── server.js            # Main server file
└── package.json
```

## Migration from Direct Supabase

The frontend has been updated to use secure API endpoints instead of direct Supabase calls:

### Before (Insecure)
```javascript
const { data } = await supabase
  .from(tableName)
  .select(`${valueField}, ${displayField}`)
  .eq(filterField, filterValue);
```

### After (Secure)
```javascript
const data = await DropdownService.getOptions(tableName, {
  valueField,
  displayField,
  filterField,
  filterValue
});
```

## Development

- `npm run dev` - Start with nodemon for auto-reload
- `npm start` - Production start
- Check `/health` endpoint for server status

## Error Handling

The API provides consistent error responses:
```json
{
  "error": "Description of the error",
  "details": ["Additional error details if validation fails"]
}
```

## CORS Configuration

CORS is configured to allow requests from the frontend URL specified in `FRONTEND_URL` environment variable.

