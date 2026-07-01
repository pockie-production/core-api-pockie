const { sign } = require('jsonwebtoken');
const https = require('https');

// Mock payload for a valid user
const payload = { id: '1', email: 'test@example.com' };
const token = sign(payload, process.env.JWT_ACCESS_SECRET || 'change_me_access_secret', { expiresIn: '1h' });

const options = {
  hostname: 'bepockie.bkuteam.site',
  path: '/api/v1/dashboard/home',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  rejectUnauthorized: false
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    if (res.statusCode === 200) {
      console.log(JSON.parse(data).wallet.month);
    } else {
      console.log(data);
    }
  });
});
req.end();
