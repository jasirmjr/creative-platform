const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount Auth Routes
app.use('/api/v1/auth', require('./routes/auth.routes'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Creative Talent API is healthy' });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the Creative Talent Platform API',
    endpoints: {
      health: '/health',
      sendOtp: 'POST /api/v1/auth/send-otp',
      verifyOtp: 'POST /api/v1/auth/verify-otp'
    }
  });
});

module.exports = app;