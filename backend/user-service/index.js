'use strict';

const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');
const axios = require('axios');
const crypto = require('crypto');

// Import helper functions
const { getS3JSON, putS3JSON, UsersAPI } = require('./s3-helpers');

const app = express();
app.use(express.json());

// S3 config management
const s3Client = new S3Client({ region: 'eu-west-1' });
const CONFIG_BUCKET = 'microbus-config-secure';
let jwtSecret = null;

async function getS3Config(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: CONFIG_BUCKET,
      Key: key
    });
    const response = await s3Client.send(command);
    const content = await response.Body.transformToString();
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to get S3 config ${key}:`, error);
    throw error;
  }
}

async function getJWTSecret() {
  if (!jwtSecret) {
    const jwtConfigData = await getS3Config('jwt-secret.json');
    jwtSecret = jwtConfigData.secret;
  }
  return jwtSecret;
}

// PIN generation și validation (fără stocare în S3)
function generateTimeBasedPIN(phone, timeSlot, secret) {
  const hash = crypto.createHmac('sha256', secret)
    .update(`${phone}-${timeSlot}`)
    .digest('hex');
  // Convert hex to numeric PIN
  const numericHash = hash.replace(/[a-f]/g, (match) => {
    return String(match.charCodeAt(0) % 10);
  });
  return numericHash.substring(0, 4);
}

function validateTimeBasedPIN(phone, submittedPin, secret) {
  const currentSlot = Math.floor(Date.now() / (5 * 60 * 1000)); // 5 minute slots
  const previousSlot = currentSlot - 1; // Permite și slot-ul anterior pentru flexibilitate
  
  // Verificăm current și previous time slot
  for (const slot of [currentSlot, previousSlot]) {
    const validPin = generateTimeBasedPIN(phone, slot, secret);
    if (validPin === submittedPin) {
      return true;
    }
  }
  return false;
}

// Helper function to format Romanian phone numbers
function formatRomanianPhone(phone) {
  // Convert +40xxxxxxxx to 0xxxxxxxx for Romanian numbers
  if (phone.startsWith('+40')) {
    return '0' + phone.substring(3);
  }
  return phone; // Return original if not Romanian format
}

// Helper function to send welcome email
async function sendWelcomeEmail(userEmail, userName, userPhone, adminNames) {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.8; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
          .content { padding: 40px 30px; }
          .welcome-text { font-size: 18px; color: #555; margin-bottom: 30px; }
          .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 5px; }
          .info-box h3 { margin-top: 0; color: #667eea; font-size: 16px; }
          .credentials { background: #fff; border: 2px solid #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .credentials p { margin: 10px 0; }
          .phone-number { font-size: 20px; font-weight: bold; color: #667eea; letter-spacing: 1px; }
          .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; margin: 20px 0; font-weight: 500; }
          .rules { background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 25px 0; }
          .rules h3 { color: #856404; margin-top: 0; }
          .rules ul { margin: 10px 0; padding-left: 20px; }
          .rules li { margin: 8px 0; color: #856404; }
          .admin-contact { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .admin-contact p { margin: 5px 0; color: #0c5460; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; border-top: 1px solid #e9ecef; }
          .icon { width: 20px; height: 20px; vertical-align: middle; margin-right: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚐 Bun venit în sistemul de rezervare Microbuz!</h1>
          </div>
          
          <div class="content">
            <p class="welcome-text">
              Salut <strong>${userName}</strong>,<br>
              Contul tău a fost creat cu succes! Acum poți accesa aplicația pentru a rezerva microbuzul adunării.
            </p>

            <div class="info-box">
              <h3>✨ Promisiunea noastră</h3>
              <p>
                Îți promitem că îți vom preda microbuzul într-o stare excelentă și te rugăm, 
                la rândul tău, să-l predai cel puțin la fel cum l-ai primit.
              </p>
            </div>

            <div class="rules">
              <h3>📋 Reguli importante</h3>
              <ul>
                <li><strong>Curățenie:</strong> Microbuzul se spală la predare</li>
                <li><strong>Combustibil:</strong> Se completează cu combustibil la predare</li>
                <li><strong>Comunicare:</strong> Anunță administratorii dacă nu reușești să-l speli sau să pui combustibil</li>
                <li><strong>Probleme tehnice:</strong> Raportează orice problemă folosind butonul "Raportează o Problemă" din aplicație</li>
              </ul>
            </div>

            <div class="info-box">
              <h3>📱 Accesează aplicația</h3>
              <p>Aplicația este disponibilă la următoarea adresă:</p>
              <a href="https://auto.bisericanicolina.ro" class="button">Deschide Aplicația</a>
              <p style="color: #666; font-size: 14px;">sau copiază link-ul: https://auto.bisericanicolina.ro</p>
            </div>

            <div class="credentials">
              <h3>🔐 Datele tale de autentificare</h3>
              <p>Te poți autentifica folosind numărul tău de telefon:</p>
              <p class="phone-number">📞 ${formatRomanianPhone(userPhone)}</p>
              <p style="color: #666; font-size: 14px; margin-top: 15px;">
                După introducerea numărului, vei primi un PIN prin SMS sau email care poate fi utilizat o singură dată pentru autentificare.
              </p>
            </div>

            <div class="admin-contact">
              <p><strong>👥 Administratori disponibili pentru ajutor:</strong></p>
              <p>${adminNames}</p>
              <p style="font-size: 14px; color: #666; margin-top: 10px;">
                Nu ezita să îi contactezi pentru orice întrebare sau problemă!
              </p>
            </div>

            <div style="text-align: center; margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
              <p style="margin: 0; color: #666;">
                Mulțumim că folosești sistemul nostru de rezervare!<br>
                <strong>Să avem grijă împreună de microbuzul comunității noastre! 🙏</strong>
              </p>
            </div>
          </div>

          <div class="footer">
            <p style="margin: 5px 0;">Biserica Creștină după Evanghelie Nr 1, Nicolina, Iași</p>
            <p style="margin: 5px 0; font-size: 12px; color: #999;">
              Acest email a fost trimis automat. Te rugăm să nu răspunzi la acest email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Bun venit, ${userName}!

Contul tău a fost creat cu succes!

PROMISIUNEA NOASTRĂ:
Îți vom preda microbuzul într-o stare excelentă și te rugăm să-l predai la fel cum l-ai primit.

REGULI IMPORTANTE:
• Microbuzul se spală la predare
• Se completează cu combustibil la predare
• Anunță administratorii dacă nu reușești să-l speli sau să pui combustibil
• Raportează problemele tehnice din aplicație

ACCESEAZĂ APLICAȚIA:
https://auto.bisericanicolina.ro

DATELE TALE DE AUTENTIFICARE:
Telefon: ${formatRomanianPhone(userPhone)}
(Vei primi PIN-ul de autentificare prin SMS sau email)

ADMINISTRATORI:
${adminNames}

--
Biserica Creștină după Evanghelie Nr 1, Nicolina, Iași
    `;

    await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/email`, {
      to: userEmail,
      subject: `Bun venit, ${userName}!`,
      html: htmlContent,
      text: textContent
    });

    console.log(`Welcome email sent to ${userEmail}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

// Authentication middleware (UPDATED pentru JSON)
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token necesar' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = await getJWTSecret();
    const decoded = jwt.verify(token, secret);
    
    // Get user details from JSON instead of MySQL
    const user = await UsersAPI.findByPhone(decoded.phone);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirat',
        code: 'TOKEN_EXPIRED'
      });
    }
    res.status(401).json({ error: 'Token invalid' });
  }
}

// Admin middleware
async function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acces interzis. Necesită rol de administrator.' });
  }
  next();
}

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request PIN (UPDATED - fără stocare, generare pe baza timpului)
app.post('/pin/request-pin', async (req, res) => {
  let { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Numărul de telefon este obligatoriu' });
  }
  
  // Clean phone number by removing spaces and other non-digit characters (except + and leading 0)
  const cleanedPhone = phone.replace(/[\s-().]/g, '');
  phone = cleanedPhone;

  try {
    // Verifică dacă utilizatorul există în JSON
    const user = await UsersAPI.findByPhone(phone);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'Phone number not found',
        message: 'Numărul de telefon nu este înregistrat în sistem.' 
      });
    }

    // Generează PIN bazat pe timp (nu îl salvăm nicăieri)
    const secret = await getJWTSecret();
    const timeSlot = Math.floor(Date.now() / (5 * 60 * 1000));
    const pin = generateTimeBasedPIN(phone, timeSlot, secret);

    // Trimite SMS prin Notification Service
    try {
      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/sms`, {
        to: phone,
        message: `${pin} - este PIN-ul tau pentru aplicatia Microbuzul Adunarii

@auto.bisericanicolina.ro #${pin}`
      });

      res.json({ message: 'PIN sent successfully' });
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
      res.json({ message: 'PIN sent successfully' }); // Nu exposăm erori interne
    }
  } catch (error) {
    console.error('PIN request error:', error);
    res.status(500).json({ error: 'Eroare la trimiterea PIN-ului' });
  }
});


// Check if user has email (UPDATED pentru JSON)
app.post('/pin/check-email', async (req, res) => {
  let { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Numărul de telefon este obligatoriu' });
  }
  
  // Clean phone number by removing spaces and other non-digit characters (except + and leading 0)
  const cleanedPhone = phone.replace(/[\s-().]/g, '');
  phone = cleanedPhone;

  try {
    const user = await UsersAPI.findByPhone(phone);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ hasEmail: !!user.email });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ error: 'Eroare la verificarea email-ului' });
  }
});

// Request PIN via email (UPDATED pentru JSON)
app.post('/pin/request-pin-email', async (req, res) => {
  let { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Numărul de telefon este obligatoriu' });
  }
  
  // Clean phone number by removing spaces and other non-digit characters (except + and leading 0)
  const cleanedPhone = phone.replace(/[\s-().]/g, '');
  phone = cleanedPhone;

  try {
    const user = await UsersAPI.findByPhone(phone);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.email) {
      return res.status(400).json({ error: 'User has no email' });
    }
    
    // Generează PIN bazat pe timp
    const secret = await getJWTSecret();
    const timeSlot = Math.floor(Date.now() / (5 * 60 * 1000));
    const pin = generateTimeBasedPIN(phone, timeSlot, secret);
    
    try {
      // Send email with PIN
      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/email`, {
        to: user.email,
        subject: `${pin} - Codul tău pentru Microbuz`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; }
              .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 25px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
              .header-icon { font-size: 40px; margin-bottom: 10px; }
              .header h1 { margin: 0; font-size: 24px; font-weight: 300; }
              .content { padding: 40px 30px; text-align: center; }
              .greeting { font-size: 20px; color: #333; margin-bottom: 20px; font-weight: 500; }
              .message { color: #666; font-size: 16px; margin-bottom: 30px; line-height: 1.5; }
              .pin-container { background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%); border: 2px solid #e0e7ff; padding: 30px; margin: 30px 0; border-radius: 16px; position: relative; }
              .pin-label { color: #6366f1; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
              .pin-code { font-size: 56px; font-weight: bold; color: #4f46e5; margin: 0; letter-spacing: 8px; text-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); }
              .pin-validity { background: #fef3c7; color: #92400e; padding: 12px 20px; border-radius: 8px; margin: 25px 0; font-size: 14px; font-weight: 500; }
              .security-note { background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 25px 0; }
              .security-note h3 { margin: 0 0 10px 0; color: #374151; font-size: 16px; }
              .security-note p { margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5; }
              .footer { background: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb; }
              .footer p { margin: 0; color: #9ca3af; font-size: 13px; }
              .logo { color: #6366f1; font-weight: bold; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="header-icon">🚐</div>
                <h1>Sisteme de Rezervare Microbuz</h1>
              </div>
              
              <div class="content">
                <div class="greeting">Bună ${user.name}! 👋</div>
                <div class="message">
                  Ai solicitat autentificarea în sistemul de rezervare Microbuz.<br>
                  Folosește codul de mai jos pentru a continua:
                </div>
                
                <div class="pin-container">
                  <div class="pin-label">Codul tău de autentificare</div>
                  <div class="pin-code">${pin}</div>
                </div>
                
                <div class="pin-validity">
                  ⏰ Acest cod este valabil doar <strong>5 minute</strong>
                </div>
                
                <div class="security-note">
                  <h3>🔒 Pentru securitatea ta</h3>
                  <p>Nu împărtăși acest cod cu nimeni. Dacă nu ai solicitat acest email, îl poți ignora în siguranță.</p>
                </div>
              </div>
              
              <div class="footer">
                <div class="logo">Biserica Creștină după Evanghelie Nr 1, Nicolina, Iași</div>
                <p>Sistem automat - nu răspunde la acest email</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Bună ${user.name}! Codul tău PIN pentru Microbuz este: ${pin}. Acest cod este valabil 5 minute.`
      });
      
      res.json({ 
        message: 'PIN sent to email successfully',
        email: user.email 
      });
    } catch (notificationError) {
      console.error('Email notification error:', notificationError);
      res.json({ 
        message: 'PIN sent to email successfully',
        email: user.email 
      });
    }
  } catch (error) {
    console.error('Email PIN request error:', error);
    res.status(500).json({ error: 'Eroare la trimiterea PIN-ului prin email' });
  }
});

// Get user details (UPDATED pentru JSON)
app.get('/auth/user-details', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token necesar' });
  }

  try {
    const secret = await getJWTSecret();
    const decoded = jwt.verify(token, secret);
    
    const user = await UsersAPI.findByPhone(decoded.phone);

    if (!user) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    // Nu returnăm informații sensibile
    const { id, name, phone, role, created_at } = user;
    res.json({ user: { id, name, phone, role, created_at } });
  } catch (error) {
    console.error('User details error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirat',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalid' });
    }
    res.status(500).json({ error: 'Eroare la preluarea detaliilor utilizatorului' });
  }
});

// Get all users (UPDATED pentru JSON)
app.get('/users', authenticate, async (req, res) => {
  try {
    const usersData = await UsersAPI.getAll();
    
    if (req.user.role === 'admin') {
      // Pentru admini - informații complete
      const users = usersData.users.map(user => ({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }));
      
      res.json(users);
    } else {
      // Pentru șoferi - doar numele
      const users = usersData.users.map(user => ({
        id: user.id,
        name: user.name
      }));
      
      res.json(users);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Nu s-au putut încărca utilizatorii' });
  }
});

// Add new user (UPDATED pentru JSON)
app.post('/users', authenticate, requireAdmin, async (req, res) => {
  const { name, phone, email, role = 'user' } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Numele și numărul de telefon sunt obligatorii' });
  }

  try {
    // Clean phone number by removing spaces and other non-digit characters (except + and leading 0)
    const cleanedPhone = phone.replace(/[\s-().]/g, '');
    
    // Verify phone number format
    const phoneRegex = /^(?:\+40|0)\d{9}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      return res.status(400).json({ error: 'Format invalid pentru numărul de telefon' });
    }

    // Verify email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Format invalid pentru adresa de email' });
      }
    }

    // Format phone number to international format
    const formattedPhone = cleanedPhone.startsWith('+40')
      ? cleanedPhone
      : cleanedPhone.startsWith('0')
        ? `+40${cleanedPhone.slice(1)}`
        : `+40${cleanedPhone}`;

    // Create user using JSON API
    const newUser = await UsersAPI.create({
      name,
      phone: formattedPhone,
      email: email || null,
      role
    });

    // If user has email, send welcome email
    if (email) {
      // Get admin names for the email
      const usersData = await UsersAPI.getAll();
      const adminNames = usersData.users
        .filter(user => user.role === 'admin')
        .map(admin => admin.name)
        .join(', ');
      
      // Send welcome email asynchronously (don't wait for it)
      sendWelcomeEmail(email, name, formattedPhone, adminNames).catch(error => {
        console.error('Error sending welcome email:', error);
      });
    }

    res.status(201).json({
      id: newUser.id,
      message: 'Utilizator creat cu succes'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error.message.includes('telefon există deja')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Eroare la crearea utilizatorului' });
  }
});

// Delete user (UPDATED pentru JSON)
app.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await UsersAPI.delete(parseInt(id));
    res.json({ message: 'Utilizator șters cu succes' });
  } catch (error) {
    console.error('Error deleting user:', error);
    
    if (error.message.includes('negăsit')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('administrator')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Eroare la ștergerea utilizatorului' });
  }
});

// Validate PIN with logging
app.post('/pincheck/validate-pin', async (req, res) => {
  const { phone, pin } = req.body;
  
  if (!phone || !pin) {
    return res.status(400).json({ error: 'Numărul de telefon și PIN-ul sunt necesare' });
  }

  try {
    const user = await UsersAPI.findByPhone(phone);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    // Verifică PIN-ul (folosind același algoritm ca pentru generare)
    const secret = await getJWTSecret();
    const now = Date.now();
    const timeSlot = Math.floor(now / (5 * 60 * 1000)); // 5 minute slots
    
    // Verifică atât slot-ul curent cât și cel anterior (pentru toleranță)
    const currentPIN = generateTimeBasedPIN(phone, timeSlot, secret);
    const previousPIN = generateTimeBasedPIN(phone, timeSlot - 1, secret);
    
    if (pin !== currentPIN && pin !== previousPIN) {
      return res.status(401).json({ error: 'PIN invalid sau expirat' });
    }

    // Autentificare reușită - generează token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        phone: user.phone,
        role: user.role 
      },
      secret,
      { expiresIn: '24h' }
    );

    // Log autentificarea reușită
    try {
      const accessLogs = await getS3JSON('access_logs.json') || { logs: [] };
      
      // Adaugă noul log
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Parsează device info din User-Agent
      let deviceInfo = 'unknown';
      let browser = 'unknown';
      let deviceModel = 'unknown';
      
      if (userAgent !== 'unknown') {
        // Detectează device-ul
        if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
          deviceInfo = 'Mobile';
        } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
          deviceInfo = 'Tablet';
        } else {
          deviceInfo = 'Desktop';
        }
        
        // Detectează browser-ul
        if (userAgent.includes('Chrome')) {
          browser = 'Chrome';
        } else if (userAgent.includes('Firefox')) {
          browser = 'Firefox';
        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
          browser = 'Safari';
        } else if (userAgent.includes('Edge')) {
          browser = 'Edge';
        }
        
        // Detectează device model - extrage numele complet din User-Agent
        
        // Extrage device name din User-Agent folosind pattern matching
        let deviceMatch = null;
        
        // Samsung devices - extrage modelul complet
        deviceMatch = userAgent.match(/SM-([A-Z0-9]+)/);
        if (deviceMatch) {
          deviceModel = `Samsung SM-${deviceMatch[1]}`;
        }
        
        // iPhone models - extrage din partea CPU iPhone OS
        else if (userAgent.includes('iPhone')) {
          const cpuMatch = userAgent.match(/CPU iPhone OS ([0-9_]+)/);
          const versionMatch = userAgent.match(/Version\/([0-9.]+)/);
          if (cpuMatch) {
            const iosVersion = cpuMatch[1].replace(/_/g, '.');
            deviceModel = `iPhone (iOS ${iosVersion})`;
          } else {
            deviceModel = 'iPhone';
          }
        }
        
        // iPad models
        else if (userAgent.includes('iPad')) {
          const cpuMatch = userAgent.match(/CPU OS ([0-9_]+)/);
          if (cpuMatch) {
            const iosVersion = cpuMatch[1].replace(/_/g, '.');
            deviceModel = `iPad (iOS ${iosVersion})`;
          } else {
            deviceModel = 'iPad';
          }
        }
        
        // Google Pixel - extrage modelul exact
        else if (userAgent.includes('Pixel')) {
          const pixelMatch = userAgent.match(/(Pixel [^;)]+)/);
          if (pixelMatch) {
            deviceModel = `Google ${pixelMatch[1]}`;
          } else {
            deviceModel = 'Google Pixel';
          }
        }
        
        // Huawei devices
        else if (userAgent.includes('HUAWEI')) {
          const huaweiMatch = userAgent.match(/HUAWEI ([^;)]+)/);
          if (huaweiMatch) {
            deviceModel = `Huawei ${huaweiMatch[1]}`;
          } else {
            deviceModel = 'Huawei';
          }
        }
        
        // Xiaomi devices
        else if (userAgent.includes('Mi ') || userAgent.includes('Redmi')) {
          const xiaomiMatch = userAgent.match(/(Mi [^;)]+|Redmi [^;)]+)/);
          if (xiaomiMatch) {
            deviceModel = `Xiaomi ${xiaomiMatch[1]}`;
          } else {
            deviceModel = 'Xiaomi';
          }
        }
        
        // OnePlus devices
        else if (userAgent.includes('OnePlus')) {
          const oneplusMatch = userAgent.match(/OnePlus ([^;)]+)/);
          if (oneplusMatch) {
            deviceModel = `OnePlus ${oneplusMatch[1]}`;
          } else {
            deviceModel = 'OnePlus';
          }
        }
        
        // LG devices
        else if (userAgent.includes('LG-')) {
          const lgMatch = userAgent.match(/LG-([^;)]+)/);
          if (lgMatch) {
            deviceModel = `LG ${lgMatch[1]}`;
          } else {
            deviceModel = 'LG';
          }
        }
        
        // Sony devices
        else if (userAgent.includes('Sony')) {
          const sonyMatch = userAgent.match(/Sony ([^;)]+)/);
          if (sonyMatch) {
            deviceModel = sonyMatch[1];
          } else {
            deviceModel = 'Sony';
          }
        }
        
        // HTC devices
        else if (userAgent.includes('HTC')) {
          const htcMatch = userAgent.match(/HTC ([^;)]+)/);
          if (htcMatch) {
            deviceModel = `HTC ${htcMatch[1]}`;
          } else {
            deviceModel = 'HTC';
          }
        }
        
        // Windows devices - extrage versiunea
        else if (userAgent.includes('Windows NT')) {
          const winMatch = userAgent.match(/Windows NT ([0-9.]+)/);
          if (winMatch) {
            const version = winMatch[1];
            if (version === '10.0') deviceModel = 'Windows 10/11';
            else if (version === '6.3') deviceModel = 'Windows 8.1';
            else if (version === '6.2') deviceModel = 'Windows 8';
            else if (version === '6.1') deviceModel = 'Windows 7';
            else deviceModel = `Windows NT ${version}`;
          } else {
            deviceModel = 'Windows PC';
          }
        }
        
        // macOS devices
        else if (userAgent.includes('Macintosh')) {
          const macMatch = userAgent.match(/Mac OS X ([0-9_]+)/);
          if (macMatch) {
            const macVersion = macMatch[1].replace(/_/g, '.');
            if (userAgent.includes('Intel')) {
              deviceModel = `Mac (Intel, macOS ${macVersion})`;
            } else if (userAgent.includes('ARM64')) {
              deviceModel = `Mac (Apple Silicon, macOS ${macVersion})`;
            } else {
              deviceModel = `Mac (macOS ${macVersion})`;
            }
          } else {
            deviceModel = 'Mac';
          }
        }
        
        // Linux devices (non-Android)
        else if (userAgent.includes('Linux') && !userAgent.includes('Android')) {
          const linuxMatch = userAgent.match(/Linux ([^;)]+)/);
          if (linuxMatch) {
            deviceModel = `Linux ${linuxMatch[1]}`;
          } else {
            deviceModel = 'Linux PC';
          }
        }
        
        // Generic Android (fallback)
        else if (userAgent.includes('Android')) {
          const androidMatch = userAgent.match(/Android ([0-9.]+)/);
          if (androidMatch) {
            deviceModel = `Android ${androidMatch[1]}`;
          } else {
            deviceModel = 'Android Device';
          }
        }
      }
      
      accessLogs.logs.unshift({
        id: Date.now(),
        user_id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown',
        device: deviceInfo,
        browser: browser,
        device_model: deviceModel,
        user_agent: userAgent
      });
      
      // Păstrează doar ultimele 20 de intrări
      accessLogs.logs = accessLogs.logs.slice(0, 20);
      
      await putS3JSON('access_logs.json', accessLogs);
    } catch (logError) {
      console.error('Error logging access:', logError);
      // Nu oprim procesul de autentificare pentru o eroare de logging
    }

    res.json({ 
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error('PIN validation error:', error);
    res.status(500).json({ error: 'Eroare la validarea PIN-ului' });
  }
});

// Get access logs (doar pentru administratori)
app.get('/admin/access-logs', authenticate, requireAdmin, async (req, res) => {
  try {
    const accessLogs = await getS3JSON('access_logs.json') || { logs: [] };
    res.json({ logs: accessLogs.logs });
  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({ error: 'Eroare la preluarea jurnalului de acces' });
  }
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