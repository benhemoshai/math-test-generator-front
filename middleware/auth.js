// middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
export const isAuthenticated = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      // ✅ Only allow active users
      if (user.status !== 'active') {
        return res.status(403).json({ 
          message: user.status === 'pending' 
            ? 'Account pending approval' 
            : 'Account not activated'
        });
      }
      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};