'use strict';

const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');

// Import S3 JSON helpers
const { UsersAPI, MaintenanceAPI } = require('./s3-helpers');

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

async function getJwtSecret() {
  if (!jwtSecret) {
    const jwtConfigData = await getS3Config('jwt-secret.json');
    jwtSecret = jwtConfigData.secret;
  }
  return jwtSecret;
}

// Map database types to frontend expected types
function mapTypeToFrontend(dbType) {
  const typeMapping = {
    'insurance': 'RCA',
    'itp': 'ITP',
    'vignette': 'Rovigneta'
  };
  return typeMapping[dbType] || dbType;
}

// Auth middleware using JSON
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token necesar' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = await getJwtSecret();
    const decoded = jwt.verify(token, secret);
    
    // Get user details including role from JSON
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
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.get('/maintenance/status', async (req, res) => {
  try {
    const data = await MaintenanceAPI.getAll();
    const items = data.maintenance || [];
    
    // Map database types to frontend expected types
    const mappedItems = items.map(item => ({
      ...item,
      type: mapTypeToFrontend(item.type)
    }));
    
    // Sort by expiry date - earliest expiration first
    const sortedItems = mappedItems.sort((a, b) => {
      const dateA = new Date(a.expiry_date);
      const dateB = new Date(b.expiry_date);
      return dateA - dateB;
    });
    
    res.json(sortedItems);
  } catch (error) {
    console.error('Error fetching maintenance status:', error);
    res.status(500).json({ error: 'Eroare la preluarea stării de mentenanță' });
  }
});

app.post('/maintenance/update', authenticate, requireAdmin, async (req, res) => {
  const { type, expiry_date } = req.body;

  if (!type || !expiry_date) {
    return res.status(400).json({ 
      error: 'Tipul documentului și data expirării sunt obligatorii' 
    });
  }

  try {
    // Validate type and normalize Romanian names
    const typeMapping = {
      'insurance': 'insurance',
      'rca': 'insurance',
      'RCA': 'insurance',
      'itp': 'itp',
      'ITP': 'itp',
      'vignette': 'vignette',
      'rovinieta': 'vignette',
      'rovigneta': 'vignette',
      'Rovigneta': 'vignette'
    };
    
    const normalizedType = typeMapping[type.toLowerCase()];
    if (!normalizedType) {
      return res.status(400).json({ 
        error: 'Tip de document invalid. Tipuri acceptate: insurance/rca, itp, vignette/rovinieta' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expiry_date)) {
      return res.status(400).json({ 
        error: 'Format dată invalid. Folosiți formatul YYYY-MM-DD' 
      });
    }

    // Check if document exists
    const existing = await MaintenanceAPI.findByType(normalizedType);

    // Use update method which handles both creation and updates
    await MaintenanceAPI.update(normalizedType, {
      expiry_date: expiry_date,
      status: 'active'
    });

    res.json({ 
      message: 'Informații de mentenanță actualizate cu succes' 
    });
  } catch (error) {
    console.error('Error updating maintenance:', error);
    res.status(500).json({ error: 'Eroare la actualizarea informațiilor de mentenanță' });
  }
});

// PATCH route for maintenance update (same as POST for compatibility)
app.patch('/maintenance/update', authenticate, requireAdmin, async (req, res) => {
  const { type, expiry_date } = req.body;

  if (!type || !expiry_date) {
    return res.status(400).json({ 
      error: 'Tipul documentului și data expirării sunt obligatorii' 
    });
  }

  try {
    // Validate type and normalize Romanian names
    const typeMapping = {
      'insurance': 'insurance',
      'rca': 'insurance',
      'RCA': 'insurance',
      'itp': 'itp',
      'ITP': 'itp',
      'vignette': 'vignette',
      'rovinieta': 'vignette',
      'rovigneta': 'vignette',
      'Rovigneta': 'vignette'
    };
    
    const normalizedType = typeMapping[type.toLowerCase()];
    if (!normalizedType) {
      return res.status(400).json({ 
        error: 'Tip de document invalid. Tipuri acceptate: insurance/rca, itp, vignette/rovinieta' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expiry_date)) {
      return res.status(400).json({ 
        error: 'Format dată invalid. Folosiți formatul YYYY-MM-DD' 
      });
    }

    // Use update method which handles both creation and updates
    await MaintenanceAPI.update(normalizedType, {
      expiry_date: expiry_date,
      status: 'active'
    });

    res.json({ 
      message: 'Informații de mentenanță actualizate cu succes' 
    });
  } catch (error) {
    console.error('Error updating maintenance:', error);
    res.status(500).json({ error: 'Eroare la actualizarea informațiilor de mentenanță' });
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
exports.handler = async (event, context) => {
  // Handle OPTIONS preflight request directly
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://auto.bisericanicolina.ro',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: ''
    };
  }

  // Use serverless-http for all other requests
  const serverlessHandler = serverless(app, {
    response: (response, event, context) => {
      response.headers = response.headers || {};
      response.headers['Access-Control-Allow-Origin'] = process.env.CORS_ORIGIN || 'https://auto.bisericanicolina.ro';
      response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
      response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      response.headers['Access-Control-Allow-Credentials'] = 'true';
      return response;
    }
  });

  return serverlessHandler(event, context);
};