import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  userId: string;
  tenantId: string;
}

export const CurrentUserParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser =>
    ctx.switchToHttp().getRequest().user,
);
