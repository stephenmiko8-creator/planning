const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'planning_assistant_secret_key_12345';

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Non authentifié. Header manquant.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, error: 'Non authentifié. Token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
  }
};
