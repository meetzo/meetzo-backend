import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './module/auth/auth.routes.js';
import errormiddleware from './middleware/error.middleware.js'
const app = express();



app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);



app.use(errormiddleware);

export default app;