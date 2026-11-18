import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MarketModule } from './market/market.module';

@Module({
  imports: [DatabaseModule, HealthModule, MarketModule],
})
export class AppModule {}
