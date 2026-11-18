import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { HrGuard, SignedInGuard } from '../auth/hr.guard';
import { CurrentPrincipal, type Principal } from '../auth/principal';
import { DepartmentsService } from './departments.service';

const nameOf = (body: unknown) => (body as { name?: string } | null)?.name ?? '';

@Controller('departments')
export class DepartmentsController {
  constructor(@Inject(DepartmentsService) private readonly departments: DepartmentsService) {}

  @Get()
  @UseGuards(SignedInGuard)
  list(@CurrentPrincipal() p: Principal) {
    return this.departments.list(p);
  }

  @Post()
  @UseGuards(HrGuard)
  add(@CurrentPrincipal() p: Principal, @Body() body: unknown) {
    return this.departments.add(p, nameOf(body));
  }

  @Patch(':id')
  @UseGuards(HrGuard)
  @HttpCode(200)
  rename(@CurrentPrincipal() p: Principal, @Param('id') id: string, @Body() body: unknown) {
    return this.departments.rename(p, id, nameOf(body));
  }

  @Delete(':id')
  @UseGuards(HrGuard)
  @HttpCode(204)
  remove(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.departments.remove(p, id);
  }
}
