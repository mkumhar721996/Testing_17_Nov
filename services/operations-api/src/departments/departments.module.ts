import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsRepository, PgDepartmentsRepository } from './departments.repository';
import { DepartmentsService } from './departments.service';

@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsService, { provide: DepartmentsRepository, useClass: PgDepartmentsRepository }],
})
export class DepartmentsModule {}
