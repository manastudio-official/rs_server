export class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  export const successResponse = (res, statusCode, data, message = 'Success') => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  };
  
  export const errorResponse = (res, statusCode, message) => {
    return res.status(statusCode).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  };
  