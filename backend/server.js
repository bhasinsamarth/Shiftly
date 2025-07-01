import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Mailjet from 'node-mailjet';

dotenv.config();

const mailjet = Mailjet.apiConnect(
  process.env.VITE_MAILJET_API_KEY,
  process.env.VITE_MAILJET_API_SECRET
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
            From: {
              Email: 'mohammedmoinmohammedshakir.shaikh@edu.sait.ca',
              Name: 'Shiftly No-Reply',
            },
            To: [{ Email: email }],
            Subject: 'You have Been Invited to Join Shiftly',
            HTMLPart: `
              <div style="font-family: Arial, sans-serif; color: #333333; font-size: 16px; line-height: 1.5;">
                <h2 style="color: #2e7d32;">You're Invited to Join Shiftly</h2>

                <p>Hello,</p>

                <p>
                  You've been invited to set up your account on <strong>Shiftly</strong>, our employee scheduling and management platform.
                </p>

                <p>
                  Please click the button below to complete your account setup:
                </p>

                <p style="text-align: center; margin: 30px 0;">
                  <a href="${link}" style="background-color: #2e7d32; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Set Up Your Account
                  </a>
                </p>

                <p>If the button above doesn’t work, copy and paste this link into your browser:</p>

                <p style="word-break: break-all; color: #1a0dab;">
                  <a href="${link}" style="color: #1a0dab;">${link}</a>
                </p>

                <hr style="border: none; border-top: 1px solid #dddddd; margin: 30px 0;">

                <p style="font-size: 14px; color: #888888;">
                  If you did not expect this invitation, you can safely ignore this email.
                </p>
              </div>
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Mailjet mailer listening on port ${PORT}`)
);
