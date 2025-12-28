import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { CustomError } from './errorHandler';

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => {
      const field = error.type === 'field' ? `${error.path}: ` : '';
      return `${field}${error.msg}`;
    });
    throw new CustomError(errorMessages.join(', '), 400);
  }

  next();
};




