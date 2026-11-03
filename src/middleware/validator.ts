import { Request, Response, NextFunction } from 'express';
import { type ZodObject, type ZodType } from 'zod';

export const validateBody = (schema: ZodType) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateQuery = (schema: ZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Express models raw query strings; controllers receive the validated/coerced result.
      req.query = await schema.parseAsync(req.query) as typeof req.query;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateParams = (schema: ZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = await schema.parseAsync(req.params) as typeof req.params;
      next();
    } catch (error) {
      next(error);
    }
  };
};
