import { Module } from '@nestjs/common';
import { ProjectDatabaseService } from './project-database.service';

@Module({
  providers: [ProjectDatabaseService],
  exports: [ProjectDatabaseService],
})
export class ProjectDatabaseModule {}
