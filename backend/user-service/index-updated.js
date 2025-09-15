'use strict';

const express = require('express');
const mysql = require('mysql2/promise');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');
const axios = require('axios');

const app = express();
app.use(express.json());

// Secrets and config management
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
              <h3>📱 Accesează aplicația</h3>
              <p>Aplicația este disponibilă la următoarea adresă:</p>
              <a href="https://auto.bisericanicolina.ro" class="button">Deschide Aplicația</a>
              <p style="color: #666; font-size: 14px;">sau copiază link-ul: https://auto.bisericanicolina.ro</p>
            </div>

            <div class="credentials">
              <h3>🔐 Datele tale de autentificare</h3>
              <p>Te poți autentifica folosind numărul tău de telefon:</p>
              <p class="phone-number">📞 ${userPhone}</p>
              <p style="color: #666; font-size: 14px; margin-top: 15px;">
                După introducerea numărului, vei primi un SMS cu un PIN care poate fi utilizat o singură dată pentru autentificare.
              </p>
            </div>

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

ACCESEAZĂ APLICAȚIA:
https://auto.bisericanicolina.ro

DATELE TALE DE AUTENTIFICARE:
Telefon: ${userPhone}
(Vei primi un SMS cu PIN-ul de autentificare)

PROMISIUNEA NOASTRĂ:
Îți vom preda microbuzul într-o stare excelentă și te rugăm să-l predai la fel cum l-ai primit.

REGULI IMPORTANTE:
• Microbuzul se spală la predare
• Se completează cu combustibil la predare
• Anunță administratorii dacă nu reușești să-l speli sau să pui combustibil
• Raportează problemele tehnice din aplicație

ADMINISTRATORI:
${adminNames}

--
Biserica Creștină după Evanghelie Nr 1, Nicolina, Iași
    `;

    await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/email`, {
      to: userEmail,
      subject: `Bun venit în sistemul de rezervare Microbuz, ${userName}!`,
      html: htmlContent,
      text: textContent
    });

    console.log(`Welcome email sent to ${userEmail}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

// Authentication middleware
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token necesar' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { jwtSecret } = await getConfig();
    const decoded = jwt.verify(token, jwtSecret);
    
    // Get user details including role
    const { dbConfig } = await getConfig();
    const connection = await mysql.createConnection(dbConfig);
    
    try {
      const [users] = await connection.query(
        'SELECT id, phone, role FROM users WHERE phone = ?',
        [decoded.phone]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'Utilizator negăsit' });
      }

      req.user = users[0];
      next();
    } finally {
      await connection.end();
    }
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
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.post('/pin/request-pin', async (req, res) => {
  let { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Numărul de telefon este obligatoriu' });
  }
  
  // Clean phone number by removing spaces and other non-digit characters (except + and leading 0)
  const cleanedPhone = phone.replace(/[\s-().]/g, '');
  phone = cleanedPhone;

  let connection;
  try {
    const { dbConfig } = await getConfig();
    connection = await mysql.createConnection(dbConfig);
    
    // Verifică dacă utilizatorul există
    const [users] = await connection.query(
      'SELECT * FROM users WHERE phone = ?',
      [phone]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        error: 'Phone number not found',
        message: 'Numărul de telefon nu este înregistrat în sistem.' 
      });
    }

    // Generează și salvează PIN-ul
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    await connection.query(
      'INSERT INTO temporary_pins (phone, pin, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE pin = VALUES(pin), created_at = NOW()',
      [phone, pin]
    );

    // Trimite SMS prin Notification Service
    try {
      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/sms`, {
        to: phone,
        message: `Codul tau de autentificare: ${pin}\n\n@bisericanicolina.ro #${pin}`
      });

      res.json({ message: 'PIN sent successfully' });
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
      // Even if notification fails, we return success since PIN was saved
      res.json({ message: 'PIN sent successfully' });
    }
  } catch (error) {
    console.error('PIN request error:', error);
    res.status(500).json({ error: 'Eroare la trimiterea PIN-ului' });
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('Connection close error:', error);
      }
    }
  }
});

app.post('/pincheck/validate-pin', async (req, res) => {
  let { phone, pin } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Numărul de telefon și PIN-ul sunt obligatorii' });
  }
  
  // Clean phone number by removing spaces and other non-digit characters (except + and leading 0)
  const cleanedPhone = phone.replace(/[\s-().]/g, '');
  phone = cleanedPhone;

  let connection;
  try {
    const { dbConfig, jwtSecret } = await getConfig();
    connection = await mysql.createConnection(dbConfig);
    
    // Verifică PIN-ul
    const [pins] = await connection.query(
      'SELECT * FROM temporary_pins WHERE phone = ? AND pin = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)',
      [phone, pin]
    );

    if (pins.length === 0) {
      return res.status(401).json({ error: 'PIN invalid sau expirat' });
    }

    // Șterge PIN-ul folosit
    await connection.query(
      'DELETE FROM temporary_pins WHERE phone = ?',
      [phone]
    );

    // Generează token cu expirare la 2 ore
    const token = jwt.sign({ phone }, jwtSecret, { expiresIn: '2h' });

    res.json({ token });
  } catch (error) {
    console.error('PIN validation error:', error);
    res.status(500).json({ error: 'Eroare la validarea PIN-ului' });
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('Connection close error:', error);
      }
    }
  }
});

app.get('/auth/user-details', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token necesar' });
  }

  let connection;
  try {
    const { dbConfig, jwtSecret } = await getConfig();
    const decoded = jwt.verify(token, jwtSecret);
    
    connection = await mysql.createConnection(dbConfig);
    const [users] = await connection.query(
      'SELECT id, name, phone, role, created_at FROM users WHERE phone = ?',
      [decoded.phone]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    res.json({ user: users[0] });
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
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('Connection close error:', error);
      }
    }
  }
});

// Get all users (admin only)
app.get('/users', authenticate, requireAdmin, async (req, res) => {
  let connection;
  try {
    const { dbConfig } = await getConfig();
    connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.query(
      'SELECT id, name, phone, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Nu s-au putut încărca utilizatorii' });
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('Connection close error:', error);
      }
    }
  }
});

// Add new user (admin only) - UPDATED WITH WELCOME EMAIL
app.post('/users', authenticate, requireAdmin, async (req, res) => {
  const { name, phone, email, role = 'user' } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Numele și numărul de telefon sunt obligatorii' });
  }

  let connection;
  try {
    const { dbConfig } = await getConfig();
    connection = await mysql.createConnection(dbConfig);
    
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

    // Check if phone number already exists
    const [existing] = await connection.query(
      'SELECT id FROM users WHERE phone = ?',
      [formattedPhone]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Numărul de telefon există deja' });
    }

    // Insert new user with email if provided
    const [result] = await connection.query(
      'INSERT INTO users (name, phone, email, role) VALUES (?, ?, ?, ?)',
      [name, formattedPhone, email || null, role]
    );

    // If user has email, send welcome email
    if (email) {
      // Get admin names for the email
      const [admins] = await connection.query(
        'SELECT name FROM users WHERE role = "admin"'
      );
      const adminNames = admins.map(admin => admin.name).join(', ');
      
      // Send welcome email asynchronously
      sendWelcomeEmail(email, name, formattedPhone, adminNames);
    }

    res.status(201).json({
      id: result.insertId,
      message: 'Utilizator creat cu succes'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Eroare la crearea utilizatorului' });
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('Connection close error:', error);
      }
    }
  }
});

// Delete user (admin only)
app.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  let connection;
  try {
    const { dbConfig } = await getConfig();
    connection = await mysql.createConnection(dbConfig);
    
    // Check if user exists and is not an admin
    const [users] = await connection.query(
      'SELECT role FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    if (users[0].role === 'admin') {
      return res.status(403).json({ error: 'Nu se pot șterge conturile de administrator' });
    }

    // Delete user
    await connection.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'Utilizator șters cu succes' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Eroare la ștergerea utilizatorului' });
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('Connection close error:', error);
      }
    }
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