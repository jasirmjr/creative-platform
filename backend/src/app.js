const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local device uploads statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Mount Auth Routes
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/categories', require('./routes/category.routes'));
app.use('/api/v1/resources', require('./routes/resource.routes'));
app.use('/api/v1/bookings', require('./routes/booking.routes'));
app.use('/api/v1/vendors', require('./routes/vendor.routes'));
app.use('/api/v1/portfolios', require('./routes/portfolio.routes'));
app.use('/api/v1/reviews', require('./routes/review.routes'));
app.use('/api/v1/schedule', require('./routes/schedule.routes'));
app.use('/api/v1/chat', require('./routes/chat.routes'));
app.use('/api/v1/complaints', require('./routes/complaint.routes'));
app.use('/api/v1/payments', require('./routes/payment.routes'));

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