import Mailjet from 'node-mailjet';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, link } = req.body;

  if (!email || !link) {
    return res.status(400).json({ error: 'Missing email or link' });
  }

  const mailjet = Mailjet.apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_API_SECRET
  );

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

    res.status(200).json({ status: 'sent' });
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
}
