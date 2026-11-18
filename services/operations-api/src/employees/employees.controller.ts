import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { HrGuard } from '../auth/hr.guard';
import { CurrentPrincipal, type Principal } from '../auth/principal';
import { ApiError } from '../common/api-error';
import { validateEmployeeInput } from './employee.validation';
import { EmployeesService } from './employees.service';

const invalid = (fieldErrors: Record<string, string>) =>
  new ApiError(422, 'VALIDATION_FAILED', 'The record was not saved.', fieldErrors);

@Controller('employees')
@UseGuards(HrGuard)
export class EmployeesController {
  constructor(@Inject(EmployeesService) private readonly employees: EmployeesService) {}

  @Get('options')
  options(@CurrentPrincipal() p: Principal) {
    return this.employees.options(p);
  }

  @Get(':id')
  get(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.employees.get(p, id);
  }

  @Post()
  create(@CurrentPrincipal() p: Principal, @Body() body: unknown) {
    const r = validateEmployeeInput(body);
    if (!r.ok) throw invalid(r.fieldErrors);
    return this.employees.create(p, r.value);
  }

  @Patch(':id')
  @HttpCode(200)
  update(@CurrentPrincipal() p: Principal, @Param('id') id: string, @Body() body: unknown) {
    const r = validateEmployeeInput(body, { partial: true });
    if (!r.ok) throw invalid(r.fieldErrors);
    return this.employees.update(p, id, r.value);
  }
}
