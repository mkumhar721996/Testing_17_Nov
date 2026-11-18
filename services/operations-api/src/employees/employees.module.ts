import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesRepository, PgEmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, { provide: EmployeesRepository, useClass: PgEmployeesRepository }],
})
export class EmployeesModule {}
