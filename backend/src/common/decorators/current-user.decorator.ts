import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The authenticated principal attached by JwtStrategy.validate(). */
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  countryCode: string;
}

/** Injects the authenticated user (or one of its properties) into a handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    return data ? user?.[data] : user;
  },
);
