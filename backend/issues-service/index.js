'use strict';

const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { UsersAPI, IssuesAPI } = require('./s3-helpers');

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

// Helper function to send SMS notifications
async function sendSmsNotification(phone, message) {
  try {
    await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/sms`, {
      to: phone,
      message
    });
  } catch (error) {
    console.error('Error sending SMS notification:', error);
  }
}

// Helper function to send email notifications
async function sendEmailNotification(emails, issue, reporter) {
  try {
    if (!emails || emails.length === 0) return;
    
    const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'https://02irqijwuf.execute-api.eu-west-1.amazonaws.com';
    
    // Create beautiful HTML email template
    const htmlContent = `
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Problemă Raportată - Microbuzul Adunării</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 20px auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">🚐</div>
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Microbuzul Adunării</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Biserica Nicolina</p>
    </div>

    <!-- Alert Banner -->
    <div style="background-color: #fed7d7; border-left: 4px solid #e53e3e; padding: 15px 20px;">
      <div style="display: flex; align-items: center;">
        <span style="font-size: 20px; margin-right: 10px;">⚠️</span>
        <span style="color: #c53030; font-weight: 600; font-size: 16px;">Problemă Nouă Raportată</span>
      </div>
    </div>

    <!-- Content -->
    <div style="padding: 30px 20px;">
      
      <!-- Issue Details -->
      <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
        <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
          <span style="margin-right: 8px;">📋</span>
          Detalii Problemă
        </h2>
        
        <div style="margin-bottom: 15px;">
          <strong style="color: #4a5568; display: inline-block; width: 80px;">Titlu:</strong>
          <span style="color: #2d3748;">${issue.title}</span>
        </div>
        
        <div style="margin-bottom: 15px;">
          <strong style="color: #4a5568; display: inline-block; width: 80px;">Descriere:</strong>
          <span style="color: #2d3748;">${issue.description}</span>
        </div>
        
        <div style="margin-bottom: 15px;">
          <strong style="color: #4a5568; display: inline-block; width: 80px;">Severitate:</strong>
          <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; ${
            issue.severity === 'urgent' 
              ? 'background-color: #fed7d7; color: #c53030;' 
              : issue.severity === 'medium'
                ? 'background-color: #feebc8; color: #c05621;'
                : 'background-color: #e6fffa; color: #38a169;'
          }">${
            issue.severity === 'urgent' 
              ? 'Urgentă' 
              : issue.severity === 'medium'
                ? 'Medie'
                : 'Minoră'
          }</span>
        </div>
        
        <div>
          <strong style="color: #4a5568; display: inline-block; width: 80px;">Locație:</strong>
          <span style="color: #2d3748;">${issue.location}</span>
        </div>
      </div>

      <!-- Reporter Info -->
      <div style="background-color: #edf2f7; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
        <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
          <span style="margin-right: 8px;">👤</span>
          Raportat de
        </h3>
        
        <div style="margin-bottom: 10px;">
          <strong style="color: #4a5568; display: inline-block; width: 70px;">Nume:</strong>
          <span style="color: #2d3748;">${reporter.name}</span>
        </div>
        
        <div style="margin-bottom: 10px;">
          <strong style="color: #4a5568; display: inline-block; width: 70px;">Telefon:</strong>
          <a href="tel:${reporter.phone}" style="color: #3182ce; text-decoration: none;">${reporter.phone}</a>
        </div>
        
        <div>
          <strong style="color: #4a5568; display: inline-block; width: 70px;">Data:</strong>
          <span style="color: #2d3748;">${new Date().toLocaleString('ro-RO', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}</span>
        </div>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="https://auto.bisericanicolina.ro" 
           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
          📱 Accesează Aplicația
        </a>
      </div>

      <!-- Footer Message -->
      <div style="text-align: center; color: #718096; font-size: 14px; line-height: 1.5;">
        <p>Te rugăm să verifici și să rezolvi această problemă cât mai curând.</p>
        <p style="margin-top: 15px;">
          <strong style="color: #4a5568;">Microbuzul Adunării</strong><br>
          Biserica Nicolina
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #edf2f7; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; color: #718096; font-size: 12px;">
        Acest email a fost generat automat de sistemul de management al microbuzului.
      </p>
    </div>
  </div>
</body>
</html>`;

    await axios.post(`${notificationServiceUrl}/notify/email`, {
      to: emails,
      subject: `🚨 Problemă Nouă: ${issue.title} [${issue.severity.toUpperCase()}]`,
      html: htmlContent
    });
    
    console.log('Email notifications sent successfully to:', emails);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

// Helper function to get admin phone numbers
async function getAdminPhones() {
  const userData = await UsersAPI.getAll();
  const admins = userData.users.filter(user => user.role === 'admin');
  return admins.map(admin => admin.phone);
}

// Helper function to get admin email addresses  
async function getAdminEmails() {
  const userData = await UsersAPI.getAll();
  const admins = userData.users.filter(user => 
    user.role === 'admin' && 
    user.email && 
    user.email.trim() !== ''
  );
  return admins.map(admin => admin.email);
}

// Auth middleware
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token necesar' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = await getJWTSecret();
    const decoded = jwt.verify(token, secret);
    
    // Get user details from S3
    const user = await UsersAPI.findByPhone(decoded.phone);

    if (!user) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Token invalid sau expirat' });
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
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://auto.bisericanicolina.ro',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    // Ensure CORS headers are set for preflight
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }
  next();
});

// Routes
app.get(['/issues', '/issues/'], authenticate, async (req, res) => {
  try {
    const issuesData = await IssuesAPI.getAll();
    const userData = await UsersAPI.getAll();
    
    // Enrich issues with reporter information
    const enrichedIssues = issuesData.issues.map(issue => {
      const reporter = userData.users.find(user => user.id === issue.reported_by);
      return {
        ...issue,
        reporter_name: reporter?.name || 'Utilizator necunoscut',
        reporter_phone: reporter?.phone || ''
      };
    });
    
    // Sort by created_at DESC
    enrichedIssues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json(enrichedIssues);
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Nu s-au putut încărca problemele' });
  }
});

app.post(['/issues', '/issues/'], authenticate, async (req, res) => {
  const { title, description, severity, location } = req.body;
  const { id: userId, name: userName, phone: userPhone } = req.user;

  if (!title || !description || !severity || !location) {
    return res.status(400).json({ error: 'Toate câmpurile sunt obligatorii' });
  }

  try {
    // Create new issue in S3
    const issueData = {
      reported_by: userId,
      title,
      description,
      severity,
      location,
      status: 'reported'
    };
    
    const newIssue = await IssuesAPI.create(issueData);

    // Notify admins via SMS
    const adminPhones = await getAdminPhones();
    const notificationMessage = `${userName} a raportat o problemă nouă: ${title}. Severitate: ${severity}`;
    
    for (const adminPhone of adminPhones) {
      await sendSmsNotification(adminPhone, notificationMessage);
    }

    // Notify admins via Email
    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      const issueEmailData = {
        title,
        description,
        severity,
        location
      };
      const reporterData = {
        name: userName,
        phone: userPhone
      };
      
      await sendEmailNotification(adminEmails, issueEmailData, reporterData);
    }

    res.status(201).json({ 
      message: 'Problema a fost raportată cu succes',
      id: newIssue.id
    });
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Nu s-a putut raporta problema' });
  }
});

app.patch('/issues/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, resolution_notes } = req.body;
  const { id: adminId } = req.user;

  try {
    // Get current issue
    const issue = await IssuesAPI.findById(id);
    if (!issue) {
      return res.status(404).json({ error: 'Problema nu a fost găsită' });
    }

    const oldStatus = issue.status;

    // Update issue status
    const updates = {
      status,
      resolution_notes: resolution_notes || null
    };

    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = adminId;
    }

    await IssuesAPI.update(id, updates);

    // Notify reporter if status changed
    if (status !== oldStatus) {
      // Get reporter details
      const reporter = await UsersAPI.findById(issue.reported_by);
      if (reporter) {
        const statusText = status === 'in_progress' ? 'în lucru' : 
                          status === 'resolved' ? 'rezolvată' : status;
        
        const notificationMessage = `Problema "${issue.title}" a fost marcată ca ${statusText}` + 
                                  (resolution_notes ? `. Notă: ${resolution_notes}` : '');
        
        await sendSmsNotification(reporter.phone, notificationMessage);
      }
    }

    res.json({ message: 'Status actualizat cu succes' });
  } catch (error) {
    console.error('Error updating issue:', error);
    res.status(500).json({ error: 'Nu s-a putut actualiza statusul' });
  }
});

// DELETE issue (admin only)
app.delete('/issues/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if issue exists
    const issue = await IssuesAPI.findById(id);
    if (!issue) {
      return res.status(404).json({ error: 'Problema nu a fost găsită' });
    }

    // Delete the issue from S3
    await IssuesAPI.delete(id);

    res.json({ message: 'Problema a fost ștearsă cu succes' });
  } catch (error) {
    console.error('Error deleting issue:', error);
    res.status(500).json({ error: 'Nu s-a putut șterge problema' });
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
