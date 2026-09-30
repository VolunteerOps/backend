process.env.NODE_ENV='test';
process.env.PORT='47831';
process.env.DATABASE_URL='postgresql://unused@127.0.0.1:1/unused?sslmode=disable';
process.env.CORS_ORIGIN='http://127.0.0.1:47831';
const {app}=await import('../src/app.js');
app.listen(47831,'127.0.0.1');
