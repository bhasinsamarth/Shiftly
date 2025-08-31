// backend/server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Mailjet from 'node-mailjet';

// Import routes
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import dropdownRoutes from './routes/dropdown.js';
import scheduleRoutes from './routes/schedule.js';
import chatRoutes from './routes/chat.js';

// Import middleware
import { authenticateToken } from './middleware/auth.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  }
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/dropdown', dropdownRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/chat', chatRoutes);

// Legacy routes (for backward compatibility during migration)
const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_API_SECRET
);

app.post('/send-invite', async (req, res) => {
  const { email, link } = req.body;
  if (!email || !link) {
    return res.status(400).json({ error: 'Missing email or link' });
  }

  try {
    await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: { Email: process.env.EMAIL_FROM, Name: 'Shiftly-NoReply' },
            To: [{ Email: email }],
            Subject: 'Shiftly Account Invitation',
            HTMLPart: `
              <p>Hello,</p>
              <p>Please click the link below to set up your account:</p>
              <p><a href="${link}">${link}</a></p>
              <p>If you didn't request this, you can safely ignore this email.</p>
            `,
          },
        ],
      });

    res.json({ status: 'sent' });
  } catch (err) {
    console.error('Mailjet error:', {
      statusCode: err.statusCode,
      message: err.message,
      responseBody: err.response && err.response.body,
    });

    res.status(500).json({
      error: err.message,
      statusCode: err.statusCode,
      details: err.response && err.response.body,
    });
  }
});

app.post('/check-content-safety', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }

  try {
    const response = await fetch(
      `${process.env.CONTENT_SAFETY_ENDPOINT}/contentmoderator/moderate/v1.0/ProcessText/Screen?language=eng`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': process.env.CONTENT_SAFETY_KEY,
          'Content-Type': 'text/plain'
        },
        body: text
      }
    );
    const result = await response.json();
    console.log('Azure Content Safety result:', result);
    res.json(result);
  } catch (err) {
    console.error('Azure Content Safety error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: isDevelopment ? error.message : 'Internal server error',
    ...(isDevelopment && { stack: error.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Shiftly API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Security: Helmet, CORS, and Rate Limiting enabled`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});