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

    // Format dates for SMS
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

    // Send SMS notification
    const bookingMessage = `Rezervarea ta pentru microbuz a fost confirmată pentru perioada ${formattedStartDate} - ${formattedEndDate}.`;
    await sendSmsNotification(phone, bookingMessage);

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
