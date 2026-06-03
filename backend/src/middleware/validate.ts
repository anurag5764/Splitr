import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Format to a clean field-level error array
    const formattedErrors = errors.array().map((err) => {
      // In express-validator v7, 'path' is used instead of 'param'
      const field = err.type === 'field' ? err.path : '';
      return {
        path: field,
        msg: err.msg,
      };
    });

    res.status(400).json({ errors: formattedErrors });
    return;
  }
  next();
};
