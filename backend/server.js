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
     // 1) Log the full error to your console
    console.error('Mailjet error:', {
      statusCode: err.statusCode,
      message: err.message,
      // Mailjet puts the API response in err.response.body
      // Mailjet puts the API response in err.response.body
      responseBody: err.response && err.response.body,
    });

    // 2) Return that info to the front-end for easier debugging
    // 2) Return that info to the front-end for easier debugging
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Mailjet mailer listening on port ${PORT}`)
);
