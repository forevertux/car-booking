// S3 Helper Functions for JSON Data Management
// Folosite pentru toate Lambda services

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: 'eu-west-1' });
const CONFIG_BUCKET = 'microbus-config-secure';

// Cache pentru performanță
const cache = new Map();
const CACHE_DURATION = 30000; // 30 secunde

/**
 * Citește un fișier JSON din S3
 */
async function getS3JSON(key) {
  try {
    // Verifică cache-ul
    const cacheKey = key;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return JSON.parse(JSON.stringify(cached.data)); // Deep clone
    }

    const command = new GetObjectCommand({
      Bucket: CONFIG_BUCKET,
      Key: key
    });
    
    const response = await s3Client.send(command);
    const content = await response.Body.transformToString();
    const data = JSON.parse(content);
    
    // Salvează în cache
    cache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
    
    return data;
  } catch (error) {
    console.error(`Failed to get S3 JSON ${key}:`, error);
    
    // Dacă fișierul nu există, returnăm o structură goală
    if (error.name === 'NoSuchKey') {
      return getEmptyStructure(key);
    }
    
    throw error;
  }
}

/**
 * Salvează un fișier JSON pe S3
 */
async function putS3JSON(key, data) {
  try {
    // Adaugă timestamp de actualizare
    data.lastUpdated = new Date().toISOString();
    
    const command = new PutObjectCommand({
      Bucket: CONFIG_BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256'
    });
    
    await s3Client.send(command);
    
    // Invalidează cache-ul
    cache.delete(key);
    
    console.log(`Successfully saved ${key} to S3`);
    return data;
  } catch (error) {
    console.error(`Failed to save S3 JSON ${key}:`, error);
    throw error;
  }
}

/**
 * Returnează structura goală pentru un tip de fișier
 */
function getEmptyStructure(key) {
  const structures = {
    'users.json': {
      users: [],
      nextId: 1,
      lastUpdated: new Date().toISOString(),
      metadata: {
        totalUsers: 0,
        totalAdmins: 0
      }
    },
    'bookings.json': {
      bookings: [],
      nextId: 1,
      lastUpdated: new Date().toISOString(),
      metadata: {
        totalBookings: 0,
        activeBookings: 0,
        completedBookings: 0
      }
    },
    'maintenance.json': {
      maintenance: [],
      nextId: 1,
      lastUpdated: new Date().toISOString(),
      metadata: {
        totalItems: 0,
        expiringSoon: 0,
        expired: 0
      }
    },
    'issues.json': {
      issues: [],
      lastUpdated: new Date().toISOString(),
      metadata: {
        totalIssues: 0,
        openIssues: 0,
        resolvedIssues: 0
      }
    }
  };
  
  return structures[key] || { data: [], lastUpdated: new Date().toISOString() };
}

/**
 * Operațiuni specifice pentru Users
 */
const UsersAPI = {
  async getAll() {
    return await getS3JSON('users.json');
  },
  
  async findByPhone(phone) {
    const data = await getS3JSON('users.json');
    return data.users.find(user => user.phone === phone);
  },
  
  async findById(id) {
    const data = await getS3JSON('users.json');
    return data.users.find(user => user.id === id);
  },
  
  async create(userData) {
    const data = await getS3JSON('users.json');
    
    // Verifică dacă telefonul există deja
    const existingUser = data.users.find(user => user.phone === userData.phone);
    if (existingUser) {
      throw new Error('Numărul de telefon există deja');
    }
    
    const newUser = {
      id: data.nextId,
      ...userData,
      created_at: new Date().toISOString()
    };
    
    data.users.push(newUser);
    data.nextId++;
    data.metadata.totalUsers = data.users.length;
    data.metadata.totalAdmins = data.users.filter(u => u.role === 'admin').length;
    
    await putS3JSON('users.json', data);
    return newUser;
  },
  
  async delete(id) {
    const data = await getS3JSON('users.json');
    
    const userIndex = data.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      throw new Error('Utilizator negăsit');
    }
    
    // Nu permite ștergerea adminilor
    if (data.users[userIndex].role === 'admin') {
      throw new Error('Nu se pot șterge conturile de administrator');
    }
    
    data.users.splice(userIndex, 1);
    data.metadata.totalUsers = data.users.length;
    data.metadata.totalAdmins = data.users.filter(u => u.role === 'admin').length;
    
    await putS3JSON('users.json', data);
    return true;
  }
};

/**
 * Operațiuni specifice pentru Bookings
 */
const BookingsAPI = {
  async getAll() {
    return await getS3JSON('bookings.json');
  },
  
  async findById(id) {
    const data = await getS3JSON('bookings.json');
    return data.bookings.find(booking => booking.id === id);
  },
  
  async create(bookingData) {
    const data = await getS3JSON('bookings.json');
    
    // Verifică conflicte de dată
    const hasConflict = data.bookings.some(booking => 
      booking.status === 'confirmed' &&
      this.dateRangesOverlap(
        booking.start_date, booking.end_date,
        bookingData.start_date, bookingData.end_date
      )
    );
    
    if (hasConflict) {
      throw new Error('Perioada selectată nu este disponibilă');
    }
    
    const newBooking = {
      id: data.nextId,
      ...bookingData,
      status: 'confirmed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    data.bookings.push(newBooking);
    data.nextId++;
    this.updateMetadata(data);
    
    await putS3JSON('bookings.json', data);
    return newBooking;
  },
  
  async update(id, updates) {
    const data = await getS3JSON('bookings.json');
    
    const bookingIndex = data.bookings.findIndex(booking => booking.id === id);
    if (bookingIndex === -1) {
      throw new Error('Rezervarea nu a fost găsită');
    }
    
    data.bookings[bookingIndex] = {
      ...data.bookings[bookingIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    this.updateMetadata(data);
    await putS3JSON('bookings.json', data);
    return data.bookings[bookingIndex];
  },
  
  async delete(id) {
    const data = await getS3JSON('bookings.json');
    
    const bookingIndex = data.bookings.findIndex(booking => booking.id === id);
    if (bookingIndex === -1) {
      throw new Error('Rezervarea nu a fost găsită');
    }
    
    data.bookings.splice(bookingIndex, 1);
    this.updateMetadata(data);
    
    await putS3JSON('bookings.json', data);
    return true;
  },
  
  dateRangesOverlap(start1, end1, start2, end2) {
    return new Date(start1) <= new Date(end2) && new Date(start2) <= new Date(end1);
  },
  
  updateMetadata(data) {
    data.metadata.totalBookings = data.bookings.length;
    data.metadata.activeBookings = data.bookings.filter(b => 
      new Date(b.end_date) >= new Date() && b.status === 'confirmed'
    ).length;
    data.metadata.completedBookings = data.bookings.filter(b => 
      new Date(b.end_date) < new Date() || b.status === 'completed'
    ).length;
  }
};

/**
 * Operațiuni specifice pentru Maintenance
 */
const MaintenanceAPI = {
  async getAll() {
    return await getS3JSON('maintenance.json');
  },
  
  async findByType(type) {
    const data = await getS3JSON('maintenance.json');
    return data.maintenance.find(item => item.type === type);
  },
  
  async update(type, updateData) {
    const data = await getS3JSON('maintenance.json');
    
    const itemIndex = data.maintenance.findIndex(item => item.type === type);
    
    if (itemIndex === -1) {
      // Creează item nou
      const newItem = {
        id: data.nextId,
        type: type,
        ...updateData,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      data.maintenance.push(newItem);
      data.nextId++;
    } else {
      // Actualizează item existent
      data.maintenance[itemIndex] = {
        ...data.maintenance[itemIndex],
        ...updateData,
        updated_at: new Date().toISOString()
      };
    }
    
    this.updateMetadata(data);
    await putS3JSON('maintenance.json', data);
    return data.maintenance;
  },
  
  updateMetadata(data) {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    data.metadata.totalItems = data.maintenance.length;
    data.metadata.expiringSoon = data.maintenance.filter(item => 
      new Date(item.expiry_date) <= thirtyDaysFromNow && new Date(item.expiry_date) > now
    ).length;
    data.metadata.expired = data.maintenance.filter(item => 
      new Date(item.expiry_date) <= now
    ).length;
  }
};

/**
 * Operațiuni specifice pentru Issues
 */
const IssuesAPI = {
  async getAll() {
    return await getS3JSON('issues.json');
  },
  
  async findById(id) {
    const data = await getS3JSON('issues.json');
    return data.issues.find(issue => issue.id === id);
  },
  
  async create(issueData) {
    const data = await getS3JSON('issues.json');
    
    const newIssue = {
      id: require('crypto').randomUUID(),
      ...issueData,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: null
    };
    
    data.issues.push(newIssue);
    this.updateMetadata(data);
    
    await putS3JSON('issues.json', data);
    return newIssue;
  },
  
  async update(id, updates) {
    const data = await getS3JSON('issues.json');
    
    const issueIndex = data.issues.findIndex(issue => issue.id === id);
    if (issueIndex === -1) {
      throw new Error('Problema nu a fost găsită');
    }
    
    // Dacă se rezolvă problema, adaugă timestamp
    if (updates.status === 'resolved' && data.issues[issueIndex].status !== 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }
    
    data.issues[issueIndex] = {
      ...data.issues[issueIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    this.updateMetadata(data);
    await putS3JSON('issues.json', data);
    return data.issues[issueIndex];
  },
  
  updateMetadata(data) {
    data.metadata.totalIssues = data.issues.length;
    data.metadata.openIssues = data.issues.filter(issue => issue.status === 'open').length;
    data.metadata.resolvedIssues = data.issues.filter(issue => issue.status === 'resolved').length;
  }
};

module.exports = {
  getS3JSON,
  putS3JSON,
  getEmptyStructure,
  UsersAPI,
  BookingsAPI,
  MaintenanceAPI,
  IssuesAPI
};