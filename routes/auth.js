// routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import { sendApprovalEmail, sendUserApprovedEmail } from '../utils/email.js'; // Import the sendApprovalEmail function


const router = express.Router();

// POST /register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, password: hashedPassword, status: 'pending' });

    // ✅ Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });

    sendApprovalEmail(user).catch((err) => {
      console.error('❌ Failed to send approval email (non-blocking):', err.message);
    });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, status:user.status } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/approve/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Update the status to 'approved'
    user.status = 'approved';
    await user.save();

    await sendUserApprovedEmail(user); // Send email to user about approval

    res.status(200).json({ message: 'User approved successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


export default router;
