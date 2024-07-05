const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const session = require('express-session'); 
const app = express();
const port = 3000;

// MongoDB connection URL and Database Name
const url = 'mongodb://localhost:27017';
const dbName = 'mydatabase';
let db;

// Create a MongoDB client and connect to the server
MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((client) => {
    console.log('Connected to MongoDB server');
    db = client.db(dbName); // Assign the database object
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1); // Exit the application if MongoDB connection fails
  });

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to serve static files (HTML, CSS, JS) from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for session management
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Note: For production, use 'secure: true' with HTTPS
}));

// POST endpoint to handle signup form submission
app.post('/signup', (req, res) => {
  const { name, branch, accountNumber, mobileNumber, pin } = req.body;

  // Check if db is properly initialized
  if (!db) {
    res.status(500).send('Error: Database connection not established.');
    return;
  }

  // Insert data into users collection
  const collection = db.collection('users');
  collection.insertOne({ name, branch, accountNumber, mobileNumber, pin, balance: 50000 }, (err, result) => {
    if (err) {
      console.error('Error inserting data:', err.message);
      res.status(500).send('Error: Failed to insert data.');
      return;
    }
    console.log(`A new user has been added with ID: ${result.insertedId}`);
    res.json({ message: 'User signed up successfully.', userID: result.insertedId });
  });
});

// POST endpoint to handle login form submission
app.post('/login', async (req, res) => {
  const { username, pin } = req.body;

  // Check if db is properly initialized
  if (!db) {
    res.status(500).send('Error: Database connection not established.');
    return;
  }

  try {
    // Check if username and pin match stored data
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ name: username, pin: pin });

    if (!user) {
      res.status(401).json({ error: 'Invalid username or PIN.' });
    } else {
      req.session.user = { username: user.name, pin: user.pin, mobileNumber: user.mobileNumber };
      res.json({ message: 'Login successful!' });
    }
  } catch (error) {
    console.error('Error during login:', error.message);
    res.status(500).send('Error: Failed to login.');
  }
});

// POST endpoint to handle money transfer form submission
app.post('/transfer', async (req, res) => {
  const { receiverAccountNumber, mobileNumber, transferPin, amount } = req.body;

  // Check if db is properly initialized
  if (!db) {
    res.status(500).send('Error: Database connection not established.');
    return;
  }

  // Verify user session
  if (!req.session.user) {
    res.status(401).send('Error: User not logged in.');
    return;
  }

  // Validate transfer PIN with the session PIN
  if (req.session.user.pin !== transferPin) {
    res.status(400).json({ error: 'Invalid PIN. Transfer failed.' });
    return;
  }

  try {
    // Check if receiver account number and mobile number match stored data
    const usersCollection = db.collection('users');
    const receiver = await usersCollection.findOne({ accountNumber: receiverAccountNumber });

    if (!receiver) {
      res.status(404).json({ error: 'Receiver account number not found. Transfer failed.' });
      return;
    }

    // Validate receiver's mobile number
    if (receiver.mobileNumber !== mobileNumber) {
      res.status(404).json({ error: 'Receiver mobile number does not match. Transfer failed.' });
      return;
    }

    // Process the money transfer logic
    await usersCollection.updateOne({ mobileNumber: req.session.user.mobileNumber }, { $inc: { balance: -parseInt(amount) } });
    await usersCollection.updateOne({ accountNumber: receiverAccountNumber }, { $inc: { balance: +parseInt(amount) } });

    res.json({ message: 'Amount transferred successfully.' });

  } catch (error) {
    console.error('Error transferring money:', error.message);
    res.status(500).send('Error: Failed to transfer money.');
  }
});

// POST endpoint to verify PIN and return balance
app.post('/api/verify-pin', async (req, res) => {
  const { pin } = req.body;

  // Check if db is properly initialized
  if (!db) {
    res.status(500).send('Error: Database connection not established.');
    return;
  }

  // Verify user session
  if (!req.session.user) {
    res.status(401).send('Error: User not logged in.');
    return;
  }

  // Validate PIN with the session PIN
  if (req.session.user.pin !== pin) {
    res.status(400).json({ message: 'Invalid PIN' });
    return;
  }

  try {
    const user = await db.collection('users').findOne({ pin });

    if (!user) {
      res.status(400).json({ message: 'Invalid PIN' });
    } else {
      res.json({ balance: user.balance });
    }
  } catch (error) {
    console.error('Error during PIN verification:', error.message);
    res.status(500).send('Error: Failed to verify PIN.');
  }
});

// POST endpoint to fetch balance (for refresh functionality)
app.post('/api/balance', async (req, res) => {
  const { pin } = req.body;

  // Check if db is properly initialized
  if (!db) {
    res.status(500).send('Error: Database connection not established.');
    return;
  }

  // Verify user session
  if (!req.session.user) {
    res.status(401).send('Error: User not logged in.');
    return;
  }

  // Validate PIN with the session PIN
  if (req.session.user.pin !== pin) {
    res.status(400).json({ message: 'Invalid PIN' });
    return;
  }

  try {
    const user = await db.collection('users').findOne({ pin });

    if (!user) {
      res.status(400).json({ message: 'Invalid PIN' });
    } else {
      res.json({ balance: user.balance });
    }
  } catch (error) {
    console.error('Error during balance fetch:', error.message);
    res.status(500).send('Error: Failed to fetch balance.');
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});