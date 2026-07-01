const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: '12345678-1234-1234-1234-123456789012', roles: [] },
  'change_me_access_secret',
  { expiresIn: '15m' }
);
console.log(token);
