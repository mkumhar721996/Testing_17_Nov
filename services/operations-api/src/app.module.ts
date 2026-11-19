import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { MarketModule } from './market/market.module';

@Module({
  imports: [DatabaseModule, AuthModule, HealthModule, DepartmentsModule, EmployeesModule, MarketModule],
})
export class AppModule {}
