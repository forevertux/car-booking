'use strict';

const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');
const axios = require('axios');

// Import helper functions
const { getS3JSON, putS3JSON, UsersAPI, BookingsAPI } = require('./s3-helpers');

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

// Auth middleware (UPDATED pentru JSON)
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token necesar' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = await getJWTSecret();
    const decoded = jwt.verify(token, secret);
    
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
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');
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

// Get all bookings (UPDATED pentru JSON)
app.get('/bookings', async (req, res) => {
  try {
    const bookingsData = await BookingsAPI.getAll();
    
    // Sortare inteligentă: viitoare cronologic, expirate anti-cronologic
    const now = new Date();
    const sortedBookings = bookingsData.bookings.sort((a, b) => {
      const aDate = new Date(a.end_date);
      const bDate = new Date(b.end_date);
      
      const aExpired = aDate < now;
      const bExpired = bDate < now;
      
      // Dacă ambele sunt expirate, sortează anti-cronologic (recent expirată prima)
      if (aExpired && bExpired) {
        return bDate - aDate;
      }
      
      // Dacă ambele sunt viitoare, sortează cronologic (apropiată prima)
      if (!aExpired && !bExpired) {
        return new Date(a.start_date) - new Date(b.start_date);
      }
      
      // Rezervările viitoare înaintea celor expirate
      return aExpired ? 1 : -1;
    });
    
    res.json(sortedBookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Eroare la preluarea rezervărilor' });
  }
});

// Create booking (UPDATED pentru JSON)
app.post('/bookings', authenticate, async (req, res) => {
  const { start_date, end_date, purpose } = req.body;
  const { phone } = req.user;
  
  console.log('Received booking request:', { start_date, end_date, purpose, phone });
  
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Datele de început și sfârșit sunt obligatorii' });
  }
  
  try {
    // Get user details from JSON
    const user = await UsersAPI.findByPhone(phone);
    if (!user) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    const name = user.name;
    
    // Check for overlapping bookings în JSON
    const bookingsData = await BookingsAPI.getAll();
    const startDateTime = new Date(start_date);
    const endDateTime = new Date(end_date);
    
    // Verifică suprapuneri cu rezervări active (nu anulate)
    const overlapping = bookingsData.bookings.filter(booking => {
      if (booking.status === 'anulata' || booking.status === 'cancelled') {
        return false;
      }
      
      const bookingStart = new Date(booking.start_date);
      const bookingEnd = new Date(booking.end_date);
      
      // Verifică dacă intervalele se suprapun
      return (
        (startDateTime >= bookingStart && startDateTime <= bookingEnd) ||
        (endDateTime >= bookingStart && endDateTime <= bookingEnd) ||
        (startDateTime <= bookingStart && endDateTime >= bookingEnd)
      );
    });

    if (overlapping.length > 0) {
      return res.status(400).json({ 
        error: 'Perioada selectată se suprapune cu o altă rezervare' 
      });
    }

    // Create booking using JSON API
    const newBooking = await BookingsAPI.create({
      userId: user.id,
      name: name,
      phone: phone,
      start_date: start_date,
      end_date: end_date,
      scope: purpose || null,
      status: 'confirmed'
    });

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

    // Get all admins with email addresses from JSON
    const usersData = await UsersAPI.getAll();
    const admins = usersData.users.filter(user => 
      user.role === 'admin' && user.email
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
      id: newBooking.id,
      message: 'Rezervare creată cu succes' 
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Eroare la crearea rezervării' });
  }
});

// Delete booking (UPDATED pentru JSON)
app.delete('/bookings/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { phone } = req.user;
  
  try {
    // Get booking details from JSON
    const booking = await BookingsAPI.findById(parseInt(id));
    if (!booking) {
      return res.status(404).json({ error: 'Rezervare negăsită' });
    }

    // Get user details from JSON
    const user = await UsersAPI.findByPhone(phone);
    if (!user) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    const isAdmin = user.role === 'admin';
    const isOwner = booking.phone === phone;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Nu aveți permisiunea de a anula această rezervare' });
    }

    // Delete booking using JSON API
    await BookingsAPI.delete(parseInt(id));

    // Format dates for SMS
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);
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
    await sendSmsNotification(booking.phone, cancelMessage);

    // Also notify admins via email about cancellation using JSON
    const usersData = await UsersAPI.getAll();
    const admins = usersData.users.filter(user => 
      user.role === 'admin' && user.email
    );

    if (admins.length > 0) {
      const adminEmails = admins.map(admin => admin.email);
      const emailSubject = `Rezervare anulată: ${booking.name}`;
      
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
                <span class="label">Nume:</span> ${booking.name}
              </div>
              <div class="detail-row">
                <span class="label">Perioada:</span> ${formattedStartDate} - ${formattedEndDate}
              </div>
              <div class="detail-row">
                <span class="label">Scopul:</span> ${booking.scope || 'Nespecificat'}
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

Nume: ${booking.name}
Perioada: ${formattedStartDate} - ${formattedEndDate}
Scopul: ${booking.scope || 'Nespecificat'}

--
Biserica Creștină după Evanghelie Nr 1, Nicolina, Iași
      `;
      
      await sendEmailNotification(adminEmails, emailSubject, htmlContent, textContent);
    }

    res.json({ message: 'Rezervare anulată cu succes' });
  } catch (error) {
    console.error('Error canceling booking:', error);
    res.status(500).json({ error: 'Eroare la anularea rezervării' });
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