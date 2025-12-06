import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Users } from '@prisma/client';

// Safe user type without password hash (what gets attached to request by strategies)
export type SafeUser = Omit<Users, 'user_PasswordHash'>;

const getCurrentUserByContext = (context: ExecutionContext): Users => {
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
