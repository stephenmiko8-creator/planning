const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'planning_assistant_secret_key_12345';

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // If not authenticated, we can optionally check if there is an open request,
    // but to be secure, we block or fallback. Here we support fallback to user_id = null (guest mode)
    // if we want to allow guests, but since we are implementing user spaces,
    // we will require authentication for operations or default to user_id = 1 if no auth is present
    // to avoid breaking legacy, but if a token is present, we verify it.
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
  }
};
