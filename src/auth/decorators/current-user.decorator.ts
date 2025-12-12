import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

// Safe user type without password hash (what gets attached to request by strategies)
export type SafeUser = Omit<User, 'passwordHash'>;

const getCurrentUserByContext = (context: ExecutionContext): User => {
  if (context.getType() === 'http') {
    const request = context.switchToHttp().getRequest();
    return request.user;
  }

  // Handle other context types if needed (WebSocket, RPC, etc.)
  throw new Error('Unsupported context type');
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    getCurrentUserByContext(context),
);
