import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../constants';
import type { AuthUser } from '../decorators/current-user.decorator';

/**
 * Enforces @Roles(...) metadata. Assumes JwtAuthGuard already ran and populated
 * request.user. A user whose role is `both` satisfies `client` or `livreur`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user for role check.');
    }

    if (!this.hasRole(user.role as Role, required)) {
      throw new ForbiddenException('Insufficient role for this resource.');
    }
    return true;
  }

  private hasRole(userRole: Role, required: Role[]): boolean {
    return required.some((role) => {
      if (userRole === role) {
        return true;
      }
      // `both` grants the client and livreur roles.
      if (userRole === Role.both && (role === Role.client || role === Role.livreur)) {
        return true;
      }
      return false;
    });
  }
}
