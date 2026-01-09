import { Controller } from '@nestjs/common';

@Controller('users')
export class UsersController {
  // Security: No public user listing endpoint
  // User information is only accessible through:
  // - GET /api/auth/me (current user)
  // - GET /api/projects/:id/members (project members only)
}
