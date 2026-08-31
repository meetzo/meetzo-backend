 import app from './src/app.js';
import cors from 'cors';
import connectDB from './src/config/db.js'

const PORT = process.env.PORT || 5000;


app.get('/', (req, res)=>{
    res.send('Meetzo server is up and running')
})

connectDB()
  .then(() => {

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });

    // ✅ Increase request timeout to 5 minutes
    server.timeout = 300000;

    // ✅ Optional but recommended
    server.keepAliveTimeout = 300000;
    server.headersTimeout = 310000;

  })
  .catch((error) => {

    console.error(
      "MongoDB connection failed:",
      error
    );

  });