// src/middlewares/error.middleware.js

const errorMiddleware = (err, req, res, next) => {
  console.error("ERROR:", err);

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error", 
  }); 
};

export default errorMiddleware;