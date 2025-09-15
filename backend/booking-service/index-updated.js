'use strict';

const express = require('express');
const mysql = require('mysql2/promise');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');
const axios = require('axios');

const app = express();
app.use(express.json());

// AWS Secrets Manager client
const secretsManager = new SecretsManagerClient({ region: 'eu-west-1' });
let dbConfig = null;
let jwtSecret = null;

async function getConfig() {
  if (!dbConfig || !jwtSecret) {
    const [dbSecrets, authSecrets] = await Promise.all([
      secretsManager.send(new GetSecretValueCommand({ SecretId: 'minibus-app-db-config' })),
      secretsManager.send(new GetSecretValueCommand({ SecretId: 'minibus-app-jwt-secret' }))
    ]);
    
    dbConfig = JSON.parse(dbSecrets.SecretString);
    jwtSecret = JSON.parse(authSecrets.SecretString).secret;
  }
  return { dbConfig, jwtSecret };
}

// Helper function to determine if a date is in DST
function isDateInDST(date) {
  // DST in Romania starts last Sunday in March at 3:00 AM
  // and ends last Sunday in October at 4:00 AM
  const year = date.getFullYear();
  
  // Last Sunday in March
  const marchDate = new Date(year, 2, 31); // March 31
  while (marchDate.getDay() !== 0) { // 0 = Sunday
    marchDate.setDate(marchDate.getDate() - 1);
  }
  marchDate.setHours(3, 0, 0, 0);

  // Last Sunday in October
  const octoberDate = new Date(year, 9, 31); // October 31
  while (octoberDate.getDay() !== 0) { // 0 = Sunday
    octoberDate.setDate(octoberDate.getDate() - 1);
  }
  octoberDate.setHours(4, 0, 0, 0);

  return date >= marchDate && date < octoberDate;
}

// Helper function to get current timezone offset for Romania
function getRomaniaTimezoneOffset(date = new Date()) {
  return isDateInDST(date) ? '+03:00' : '+02:00';
}

// Auth middleware
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token necesar' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { jwtSecret } = await getConfig();
    const decoded = jwt.verify(token, jwtSecret);
    
    req.user = {
      phone: decoded.phone
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Token invalid sau expirat' });
  }
}

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper function to send SMS notification
async function sendSmsNotification(phone, message) {
  try {
    await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/sms`, {
      to: phone,
      message: message
    });
  } catch (error) {
    console.error('Error sending SMS notification:', error);
  }
}

// Helper function to send Email notification
async function sendEmailNotification(emails, subject, html, text) {
  try {
    await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/email`, {
      to: emails,
      subject: subject,
      html: html,
      text: text
    });
    console.log('Email notification sent to admins:', emails);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

// Routes
app.get('/bookings', async (req, res) => {
  let connection;
  try {
    const { dbConfig } = await getConfig();
    connection = await mysql.createConnection(dbConfig);
    
    // Set timezone based on current DST status
    const tzOffset = getRomaniaTimezoneOffset();
    await connection.query(`SET time_zone = '${tzOffset}'`);
    
    const [bookings] = await connection.query(
      'SELECT * FROM bookings ORDER BY created_at DESC'
    );
    
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Eroare la preluarea rezervărilor' });
  } finally {
    if (connection) await connection.end();
  }
});

app.post('/bookings', authenticate, async (req, res) => {
  const { start_date, end_date, purpose } = req.body;
  const { phone } = req.user;
  
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Datele de început și sfârșit sunt obligatorii' });
  }
  
  let connection;
  try {
    const { dbConfig } = await getConfig();
    connection = await mysql.createConnection(dbConfig);
    
    // Set timezone based on current DST status
    const tzOffset = getRomaniaTimezoneOffset();
    await connection.query(`SET time_zone = '${tzOffset}'`);
    
    // Get user details
    const [users] = await connection.query(
      'SELECT name FROM users WHERE phone = ?',
      [phone]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    const name = users[0].name;
    
    // Check for overlapping bookings
    const [overlapping] = await connection.query(
      `SELECT * FROM bookings 
       WHERE status != 'anulata' 
       AND ((start_date BETWEEN ? AND ?) 
       OR (end_date BETWEEN ? AND ?)
       OR (? BETWEEN start_date AND end_date))`,
      [start_date, end_date, start_date, end_date, start_date]
    );

    if (overlapping.length > 0) {
      return res.status(400).json({ 
        error: 'Perioada selectată se suprapune cu o altă rezervare' 
      });
    }

    // Create booking
    const [result] = await connection.query(
      'INSERT INTO bookings (phone, name, start_date, end_date, scope, status) VALUES (?, ?, ?, ?, ?, "confirmata")',
      [phone, name, start_date, end_date, purpose || null]
    );

    // Format dates for notifications
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const formattedStartDate = startDate.toLocaleDateString('ro-RO', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
    const formattedEndDate = endDate.toLocaleDateString('ro-RO', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric'
    });
    const formattedStartTime = startDate.toLocaleTimeString('ro-RO', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
    const formattedEndTime = endDate.toLocaleTimeString('ro-RO', { 
      hour: '2-digit', 
      minute: '2-digit'
    });

    // Send SMS notification to the user who made the booking
    const bookingMessage = `Rezervarea ta pentru microbuz a fost confirmată pentru perioada ${formattedStartDate} - ${formattedEndDate}.`;
    await sendSmsNotification(phone, bookingMessage);

    // Get all admins with email addresses
    const [admins] = await connection.query(
      'SELECT name, email FROM users WHERE role = "admin" AND email IS NOT NULL'
    );

    // If there are admins with email, send notification
    if (admins.length > 0) {
      const adminEmails = admins.map(admin => admin.email);
      
      // Email subject with user's name
      const emailSubject = `${name} a făcut o rezervare`;
      
      // HTML email content
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #555; }
            .value { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Rezervare nouă pentru microbuz</h2>
            </div>
            <div class="content">
              <div class="detail-row">
                <span class="label">Nume:</span> <span class="value">${name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Perioada:</span> <span class="value">${formattedStartDate} - ${formattedEndDate}</span>
              </div>
              <div class="detail-row">
                <span class="label">Scopul:</span> <span class="value">${purpose || 'Nespecificat'}</span>
              </div>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                Biserica Creștină după Evanghelie Nr 1, Nicolina, Iași
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Plain text version
      const textContent = `
Rezervare nouă pentru microbuz

Nume: ${name}
Perioada: ${formattedStartDate} - ${formattedEndDate}
Scopul: ${purpose || 'Nespecificat'}

--
Biserica Creștină după Evanghelie Nr 1, Nicolina, Iași
      `;
      
      // Send email notification to all admins
      await sendEmailNotification(adminEmails, emailSubject, htmlContent, textContent);
    }

    res.status(201).json({ 
      id: result.insertId,
      message: 'Rezervare creată cu succes' 
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Eroare la crearea rezervării' });
  } finally {
    if (connection) await connection.end();
  }
});

app.delete('/bookings/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { phone } = req.user;
  
  let connection;
  try {
    const { dbConfig } = await getConfig();
    connection = await mysql.createConnection(dbConfig);
    
    // Set timezone based on current DST status
    const tzOffset = getRomaniaTimezoneOffset();
    await connection.query(`SET time_zone = '${tzOffset}'`);
    
    // Get booking and user details
    const [bookings] = await connection.query(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Rezervare negăsită' });
    }

    const [users] = await connection.query(
      'SELECT role FROM users WHERE phone = ?',
      [phone]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    const isAdmin = users[0].role === 'admin';
    const isOwner = bookings[0].phone === phone;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Nu aveți permisiunea de a anula această rezervare' });
    }

    // Delete booking
    await connection.query(
      'DELETE FROM bookings WHERE id = ?',
      [id]
    );

    // Format dates for SMS
    const startDate = new Date(bookings[0].start_date);
    const endDate = new Date(bookings[0].end_date);
    const formattedStartDate = startDate.toLocaleDateString('ro-RO', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
    const formattedEndDate = endDate.toLocaleDateString('ro-RO', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric'
    });

    // Send SMS notification
    const cancelMessage = `Rezervarea ta pentru microbuz din perioada ${formattedStartDate} - ${formattedEndDate} a fost anulată.`;
    await sendSmsNotification(bookings[0].phone, cancelMessage);

    // Also notify admins via email about cancellation
    const [admins] = await connection.query(
      'SELECT name, email FROM users WHERE role = "admin" AND email IS NOT NULL'
    );

    if (admins.length > 0) {
      const adminEmails = admins.map(admin => admin.email);
      const emailSubject = `Rezervare anulată: ${bookings[0].name}`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f44336; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #555; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Rezervare anulată</h2>
            </div>
            <div class="content">
              <div class="detail-row">
                <span class="label">Nume:</span> ${bookings[0].name}
              </div>
              <div class="detail-row">
                <span class="label">Perioada:</span> ${formattedStartDate} - ${formattedEndDate}
              </div>
              <div class="detail-row">
                <span class="label">Scopul:</span> ${bookings[0].scope || 'Nespecificat'}
              </div>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                Biserica Creștină după Evanghelie Nr 1, Nicolina, Iași
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const textContent = `
Rezervare anulată

Nume: ${bookings[0].name}
Perioada: ${formattedStartDate} - ${formattedEndDate}
Scopul: ${bookings[0].scope || 'Nespecificat'}

--
Biserica Creștină după Evanghelie Nr 1, Nicolina, Iași
      `;
      
      await sendEmailNotification(adminEmails, emailSubject, htmlContent, textContent);
    }

    res.json({ message: 'Rezervare anulată cu succes' });
  } catch (error) {
    console.error('Error canceling booking:', error);
    res.status(500).json({ error: 'Eroare la anularea rezervării' });
  } finally {
    if (connection) await connection.end();
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