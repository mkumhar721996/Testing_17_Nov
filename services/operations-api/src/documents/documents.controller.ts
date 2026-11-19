import {
  Body,
  Catch,
  Controller,
  type ArgumentsHost,
  type ExceptionFilter,
  Get,
  Inject,
  Param,
  PayloadTooLargeException,
  Post,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HrGuard, SignedInGuard } from '../auth/hr.guard';
import { CurrentPrincipal, type Principal } from '../auth/principal';
import { ApiError } from '../common/api-error';
import { MAX_BYTES, SIZE_ERROR, type UploadedFile as UploadedDocument } from './document.validation';
import { DocumentsService } from './documents.service';

/** The part of the Express response used here (the Express types are not a direct dependency). */
interface Response {
  status(code: number): Response;
  json(body: unknown): void;
  setHeader(name: string, value: string): Response;
  send(body: Buffer): void;
}

/** A file far past the limit is cut off by multer; answer it like any other oversize file. */
@Catch(PayloadTooLargeException)
class OversizeFilter implements ExceptionFilter {
  catch(_: PayloadTooLargeException, host: ArgumentsHost) {
    const err = new ApiError(422, 'VALIDATION_FAILED', 'The document was not uploaded.', { file: SIZE_ERROR });
    host.switchToHttp().getResponse<Response>().status(err.getStatus()).json(err.getResponse());
  }
}

@Controller('employees/:employeeId/documents')
@UseGuards(SignedInGuard)
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentPrincipal() p: Principal, @Param('employeeId') employeeId: string) {
    return this.documents.list(p, employeeId);
  }

  // One byte over the maximum, so an oversize file reaches validation and gets the size message.
  // The HR guard runs before the file interceptor, so a non-HR caller gets 403 without the body being parsed.
  @Post()
  @UseGuards(HrGuard)
  @UseFilters(OversizeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES + 1 } }))
  async upload(
    @CurrentPrincipal() p: Principal,
    @Param('employeeId') employeeId: string,
    @Body() body: { docType?: unknown },
    @UploadedFile() file: UploadedDocument | undefined,
  ) {
    await this.documents.upload(p, employeeId, { docType: body?.docType, file });
    return { uploaded: true };
  }

  @Get(':id/content')
  async content(
    @CurrentPrincipal() p: Principal,
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const doc = await this.documents.download(p, employeeId, id);
    res
      .setHeader('Content-Type', doc.contentType)
      .setHeader('Content-Disposition', 'inline')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .send(doc.content);
  }
}
