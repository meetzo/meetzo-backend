// import app from './src/app.js';
// import cors from 'cors';
// import connectDB from './src/config/db.js'

// const PORT = process.env.PORT || 5001;

// app.get('/', (req, res)=>{
//     res.send('Meetzo server is up and running')
// })

// connectDB()
//   .then(() => {

//     const server = app.listen(PORT, "0.0.0.0", () => {
//       console.log(`Server running on port ${PORT}`);
//     });

//     // ✅ Increase request timeout to 5 minutes
//     server.timeout = 300000;

//     // ✅ Optional but recommended
//     server.keepAliveTimeout = 300000;
//     server.headersTimeout = 310000;

//   })
//   .catch((error) => {

//     console.error(
//       "MongoDB connection failed:",
//       error
//     );

//   });

import "dotenv/config";

import http from "http";

import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { initializeSocket } from "./src/socket/socket.js";

const PORT = process.env.PORT || 5001;

/*
|--------------------------------------------------------------------------
| Root Route
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  return res.send("Meetzo server is up and running");
});

/*
|--------------------------------------------------------------------------
| Create HTTP Server
|--------------------------------------------------------------------------
*/

const httpServer = http.createServer(app);

/*
|--------------------------------------------------------------------------
| Initialize Socket.IO
|--------------------------------------------------------------------------
*/

initializeSocket(httpServer);

console.log("");
console.log("======================================");
console.log("⏳ Connecting to MongoDB...");
console.log("======================================");
console.log("");

connectDB()
  .then(() => {
    console.log("======================================");
    console.log("✅ MongoDB connected successfully");

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log("======================================");
      console.log("🚀 MEETZO SERVER STARTED");
      console.log(`🌐 Port       : ${PORT}`);
      console.log(`🔗 Local URL  : http://localhost:${PORT}`);
      console.log("🔌 Socket.IO  : Initialized");
      console.log("🗄️  MongoDB    : Connected");
      console.log("======================================");
    });

    /*
    |--------------------------------------------------------------------------
    | Server Timeouts
    |--------------------------------------------------------------------------
    */

    // 5 minutes
    httpServer.timeout = 300000;

    httpServer.keepAliveTimeout = 300000;

    httpServer.headersTimeout = 310000;
  })
  .catch((error) => {
    console.log("");
    console.log("======================================");
    console.log("❌ MongoDB connection failed");
    console.log("======================================");

    console.error("Error:", error.message);

    console.log("");

    process.exit(1);
  });

