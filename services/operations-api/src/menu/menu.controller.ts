import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Caller } from './menu.repository';
import { MenuService } from './menu.service';

const Uuid = new ParseUUIDPipe();
type Body_ =Record<string, unknown>;
type CallerRequest = { caller: Caller };

@Controller('restaurants/:rid/menu')
export class MenuController {
  constructor(@Inject(MenuService) private readonly menu: MenuService) {}

  @Get()
  async get(
    @Param('rid', Uuid) rid: string,
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string): void },
  ) {
    // Customers must see saved edits and removals on their next load.
    res.setHeader('Cache-Control', 'no-store');
    return this.menu.getMenu(rid);
  }

  @UseGuards(AuthGuard)
  @Post('sections')
  addSection(@Req() req: CallerRequest, @Param('rid', Uuid) rid: string, @Body() body: Body_) {
    return this.menu.addSection(req.caller, rid, body);
  }

  @UseGuards(AuthGuard)
  @Patch('sections/:sid')
  renameSection(
    @Req() req: CallerRequest,
    @Param('rid', Uuid) rid: string,
    @Param('sid', Uuid) sid: string,
    @Body() body: Body_,
  ) {
    return this.menu.renameSection(req.caller, rid, sid, body);
  }

  @UseGuards(AuthGuard)
  @Delete('sections/:sid')
  @HttpCode(204)
  removeSection(@Req() req: CallerRequest, @Param('rid', Uuid) rid: string, @Param('sid', Uuid) sid: string) {
    return this.menu.removeSection(req.caller, rid, sid);
  }

  @UseGuards(AuthGuard)
  @Post('sections/:sid/items')
  addItem(
    @Req() req: CallerRequest,
    @Param('rid', Uuid) rid: string,
    @Param('sid', Uuid) sid: string,
    @Body() body: Body_,
  ) {
    return this.menu.addItem(req.caller, rid, sid, body);
  }

  @UseGuards(AuthGuard)
  @Patch('items/:iid')
  updateItem(
    @Req() req: CallerRequest,
    @Param('rid', Uuid) rid: string,
    @Param('iid', Uuid) iid: string,
    @Body() body: Body_,
  ) {
    return this.menu.updateItem(req.caller, rid, iid, body);
  }

  @UseGuards(AuthGuard)
  @Delete('items/:iid')
  @HttpCode(204)
  removeItem(@Req() req: CallerRequest, @Param('rid', Uuid) rid: string, @Param('iid', Uuid) iid: string) {
    return this.menu.removeItem(req.caller, rid, iid);
  }
}
