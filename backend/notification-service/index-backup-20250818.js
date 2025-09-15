'use strict';

const express = require('express');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const serverless = require('serverless-http');
const twilio = require('twilio');

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Secrets management with error handling
const secretsManager = new SecretsManagerClient({ region: 'eu-west-1' });
let twilioConfig = null;
let twilioClient = null;

async function initTwilio() {
  try {
    if (!twilioConfig) {
      const response = await secretsManager.send(
        new GetSecretValueCommand({ SecretId: 'minibus-app-twilio-config' })
      );
      twilioConfig = JSON.parse(response.SecretString);
      twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    }
    return twilioClient;
  } catch (error) {
    console.error('Failed to initialize Twilio:', error);
    throw new Error('Eroare la inițializarea serviciului de SMS');
  }
}

// Input validation middleware
function validateSmsRequest(req, res, next) {
  const { to, message } = req.body;

  if (!to || typeof to !== 'string') {
    return res.status(400).json({ 
      error: 'Numărul de telefon este obligatoriu și trebuie să fie un string' 
    });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ 
      error: 'Mesajul este obligatoriu și trebuie să fie un string' 
    });
  }

  // Basic phone number validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(to)) {
    return res.status(400).json({ 
      error: 'Numărul de telefon trebuie să fie în format internațional (ex: +40123456789)' 
    });
  }

  next();
}

// Routes
app.post('/notify/sms', validateSmsRequest, async (req, res) => {
  const { to, message } = req.body;

  try {
    const client = await initTwilio();
    
    const result = await client.messages.create({
      body: message,
      messagingServiceSid: twilioConfig.messagingServiceSid,
      to: to
    });

    console.log('SMS sent successfully:', {
      sid: result.sid,
      status: result.status,
      to: to
    });

    res.json({ 
      message: 'SMS trimis cu succes',
      sid: result.sid 
    });
  } catch (error) {
    console.error('SMS sending error:', error);
    
    // Handle specific Twilio errors
    if (error.code === 21211) {
      return res.status(400).json({ 
        error: 'Număr de telefon invalid' 
      });
    }
    if (error.code === 21608) {
      return res.status(400).json({ 
        error: 'Numărul de telefon nu este verificat în Twilio' 
      });
    }
    if (error.code === 21614) {
      return res.status(400).json({ 
        error: 'Numărul expeditorului nu este valid' 
      });
    }

    res.status(500).json({ 
      error: 'Eroare la trimiterea SMS-ului',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'notification',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Eroare internă de server',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Lambda handler
exports.handler = serverless(app);
