// backend/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Mailjet from 'node-mailjet';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_API_SECRET
);

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

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
            To:   [{ Email: email }],
            Subject: 'Shiftly Account Invitation',
            HTMLPart: `
              <p>Hello,</p>
              <p>Please click the link below to set up your account:</p>
              <p><a href="${link}">${link}</a></p>
              <p>If you didn’t request this, you can safely ignore this email.</p>
            `,
          },
        ],
      });

    res.json({ status: 'sent' });
  } catch (err) {
     // 1) Log the full error to your console
    console.error('Mailjet error:', {
      statusCode: err.statusCode,
      message: err.message,
      // Mailjet puts the API response in err.response.body
      responseBody: err.response && err.response.body,
    });

    // 2) Return that info to the front-end for easier debugging
    res.status(500).json({
      error: err.message,
      statusCode: err.statusCode,
      details: err.response && err.response.body,
    });
  }
});

// Clock validation endpoint - validates location before clock in/out
app.post('/validate-clock-location', async (req, res) => {
  try {
    const { userId, storeId, userLatitude, userLongitude, action } = req.body;

    if (!userId || !storeId || !userLatitude || !userLongitude || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get store location from coordinates column
    const { data: store, error: storeError } = await supabase
      .from('store')
      .select('store_name, coordinates')
      .eq('store_id', storeId)
      .single();

    if (storeError || !store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    if (!store.coordinates || !store.coordinates.latitude || !store.coordinates.longitude) {
      return res.status(400).json({ error: 'Store location not configured' });
    }

    // Calculate distance using Haversine formula
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (userLatitude * Math.PI) / 180;
    const φ2 = (store.coordinates.latitude * Math.PI) / 180;
    const Δφ = ((store.coordinates.latitude - userLatitude) * Math.PI) / 180;
    const Δλ = ((store.coordinates.longitude - userLongitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in meters

    const allowedRadius = 50; // 50 meters
    const isWithinRadius = distance <= allowedRadius;

    res.json({
      valid: isWithinRadius,
      distance: Math.round(distance),
      allowedRadius: allowedRadius,
      storeName: store.store_name
    });

  } catch (error) {
    console.error('Clock validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get clock statistics from time_log column
app.get('/clock-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'week' } = req.query; // week, month, all

    let startDate;
    const now = new Date();

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date('1970-01-01');
    }

    const { data: schedules, error } = await supabase
      .from('store_schedule')
      .select('time_log, start_time')
      .eq('employee_id', userId)
      .gte('start_time', startDate.toISOString())
      .not('time_log', 'is', null);

    if (error) throw error;


    let totalHours = 0;
    let totalDays = 0;

    schedules.forEach(schedule => {
      if (schedule.time_log && Array.isArray(schedule.time_log)) {
        const logs = schedule.time_log.slice();
        // Sort logs chronologically
        logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        let workPeriods = [];
        let breakPeriods = [];
        let clockIn = null;
        let currentBreakStart = null;

        logs.forEach(log => {
          switch (log.type) {
            case 'clock_in':
              if (clockIn === null) {
                clockIn = new Date(log.timestamp);
              } else {
                // If already clocked in, treat as accidental double punch, ignore
              }
              break;
            case 'clock_out':
              if (clockIn !== null) {
                const clockOut = new Date(log.timestamp);
                workPeriods.push({ start: clockIn, end: clockOut });
                clockIn = null;
              }
              break;
            case 'break_start':
              if (currentBreakStart === null) {
                currentBreakStart = new Date(log.timestamp);
              }
              break;
            case 'break_end':
              if (currentBreakStart !== null) {
                const breakEnd = new Date(log.timestamp);
                breakPeriods.push({ start: currentBreakStart, end: breakEnd });
                currentBreakStart = null;
              }
              break;
          }
        });

        // If still clocked in at the end of logs, ignore incomplete period
        // If still on break at end, ignore incomplete break

        // Calculate total work time minus breaks for this schedule
        let scheduleHours = 0;
        workPeriods.forEach(wp => {
          let workDuration = (wp.end - wp.start) / (1000 * 60 * 60); // in hours
          // Subtract any break time that falls within this work period
          let breakDuration = 0;
          breakPeriods.forEach(bp => {
            // Only count break if it falls within this work period
            const breakStart = Math.max(wp.start, bp.start);
            const breakEnd = Math.min(wp.end, bp.end);
            if (breakEnd > breakStart) {
              breakDuration += (breakEnd - breakStart) / (1000 * 60 * 60);
            }
          });
          scheduleHours += Math.max(0, workDuration - breakDuration);
        });
        if (scheduleHours > 0) {
          totalHours += scheduleHours;
          totalDays++;
        }
      }
    });

    res.json({
      period,
      totalHours: Math.round(totalHours * 100) / 100,
      totalDays: totalDays,
      averageHoursPerDay: totalDays > 0 ? Math.round((totalHours / totalDays) * 100) / 100 : 0
    });

  } catch (error) {
    console.error('Clock stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Mailjet mailer listening on port ${PORT}`)
);
