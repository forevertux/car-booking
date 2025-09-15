# API Updates Needed for Email PIN

## New Endpoints to Add to User Service

### 1. Check if user has email
```javascript
app.post('/pin/check-email', async (req, res) => {
  const { phone } = req.body;
  
  // Check if user exists and has email
  const [users] = await connection.query(
    'SELECT email FROM users WHERE phone = ?',
    [phone]
  );
  
  if (users.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ hasEmail: !!users[0].email });
});
```

### 2. Request PIN via Email
```javascript
app.post('/pin/request-pin-email', async (req, res) => {
  const { phone } = req.body;
  
  // Get user email
  const [users] = await connection.query(
    'SELECT email, name FROM users WHERE phone = ?',
    [phone]
  );
  
  if (!users[0].email) {
    return res.status(400).json({ error: 'User has no email' });
  }
  
  // Generate PIN
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  
  // Save PIN to database
  await connection.query(
    'INSERT INTO temporary_pins (phone, pin, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE pin = VALUES(pin), created_at = NOW()',
    [phone, pin]
  );
  
  // Send email with PIN
  await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/email`, {
    to: users[0].email,
    subject: `Codul tău PIN pentru Microbuz: ${pin}`,
    html: `
      <h2>Bună ${users[0].name}!</h2>
      <p>Codul tău PIN pentru autentificare este:</p>
      <h1 style="font-size: 48px; color: #4F46E5;">${pin}</h1>
      <p>Acest cod este valabil 5 minute.</p>
    `,
    text: `Codul tău PIN este: ${pin}`
  });
  
  res.json({ message: 'PIN sent to email' });
});
```

## To deploy these changes:
1. Update the Lambda function for user-service
2. Ensure NOTIFICATION_SERVICE_URL environment variable is set
3. Test with existing users that have email addresses