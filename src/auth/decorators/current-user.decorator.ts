import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// User type definition (no longer using Prisma)
export type User = {
  id: string;
  email: string;
  passwordHash: string;
  name?: string | null;
  createdAt?: Date | null;
  emailVerified?: boolean;
  lastLogin?: Date | null;
  isActive?: boolean;
  updatedAt?: Date | null;
};

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
