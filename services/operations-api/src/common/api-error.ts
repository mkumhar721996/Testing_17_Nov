import { HttpException } from '@nestjs/common';

/** An HTTP error carrying a stable machine-readable `code` and optional per-field messages. */
export class ApiError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super({ code, message, ...(fieldErrors ? { fieldErrors } : {}) }, status);
  }
}

export const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', `${what} not found`);
