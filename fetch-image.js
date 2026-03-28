import https from 'https';

https.get('https://ibb.co/SwJDQHNJ', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const match = data.match(/https:\/\/i\.ibb\.co\/[^\/]+\/[^"]+/);
    if (match) {
      console.log(match[0]);
    } else {
      console.log('No match found');
    }
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
