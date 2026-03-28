async function test() {
  const res = await fetch('https://bzlbrekelzbzlufawxor.supabase.co/rest/v1/bookings?select=*&limit=1', {
    method: 'OPTIONS',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bGJyZWtlbHpiemx1ZmF3eG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzQ1MzQsImV4cCI6MjA4OTcxMDUzNH0.HtxtL5kmBxiY_CTAE-yUMjXMQXx89AyZ54mWx6jwgvU',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bGJyZWtlbHpiemx1ZmF3eG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzQ1MzQsImV4cCI6MjA4OTcxMDUzNH0.HtxtL5kmBxiY_CTAE-yUMjXMQXx89AyZ54mWx6jwgvU'
    }
  });
  console.log(res.headers.get('allow'));
}
test();
