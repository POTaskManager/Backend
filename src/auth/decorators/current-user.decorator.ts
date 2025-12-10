import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { users } from '@prisma/client';

// Safe user type without password hash (what gets attached to request by strategies)
export type SafeUser = Omit<users, 'user_password_hash'>;

const getCurrentUserByContext = (context: ExecutionContext): users => {
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
