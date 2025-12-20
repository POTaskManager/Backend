import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { InvitationsService } from './invitations.service';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, InvitationsService],
  exports: [ProjectsService, InvitationsService],
})
export class ProjectsModule {}
