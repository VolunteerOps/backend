export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: unknown, code = 'validation_failed') {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Authentication required', code = 'unauthorized') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'Insufficient permissions', code = 'forbidden') {
    return new ApiError(403, code, message);
  }

  static notFound(resource = 'Resource', code = 'not_found') {
    return new ApiError(404, code, `${resource} not found`);
  }

  static conflict(message = 'Resource already exists or constraint violation', code = 'conflict') {
    return new ApiError(409, code, message);
  }

  static internal(message = 'Internal server error', code = 'internal_error', details?: unknown) {
    return new ApiError(500, code, message, details);
  }
}
