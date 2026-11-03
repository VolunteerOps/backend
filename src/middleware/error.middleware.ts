import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../core/errors.js';
import { logger } from '../core/logger.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'not_found',
    message: 'The requested route does not exist',
    request_id: res.locals.requestId,
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation_failed',
      message: 'Request payload validation failed',
      details: err.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
        ...('minimum' in e ? { minimum:e.minimum,type:e.origin } : {}),
        ...('maximum' in e ? { maximum:e.maximum,type:e.origin } : {}),
        ...('expected' in e ? { expected:e.expected === 'int' ? 'integer' : e.expected } : {}),
      })),
    });
    return;
  }

  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as SyntaxError & { status?: number }).status === 400 &&
    'body' in err
  ) {
    res.status(400).json({
      error: 'malformed_json',
      message: 'Request body contains invalid JSON',
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      res.status(409).json({
        error: 'unique_constraint',
        message: `A record with this ${target} already exists`,
        details: err.meta,
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: 'not_found',
        message: 'The requested database record does not exist',
      });
      return;
    }
  }

  logger.error('UNHANDLED_REQUEST_ERROR', { request_id: res.locals.requestId, method: req.method });

  res.status(500).json({
    error: 'internal_error',
    message: 'An unexpected internal server error occurred',
    details: process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined,
  });
}
