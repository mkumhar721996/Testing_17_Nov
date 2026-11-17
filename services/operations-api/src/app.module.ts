import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MenuModule } from './menu/menu.module';

@Module({
  imports: [DatabaseModule, AuthModule, HealthModule, MenuModule],
})
export class AppModule {}
