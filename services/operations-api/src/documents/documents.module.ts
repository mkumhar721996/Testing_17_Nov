import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository, PgDocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, { provide: DocumentsRepository, useClass: PgDocumentsRepository }],
})
export class DocumentsModule {}
