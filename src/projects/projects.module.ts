import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, InvitationsService],
  exports: [ProjectsService, InvitationsService],
})
export class ProjectsModule {}
