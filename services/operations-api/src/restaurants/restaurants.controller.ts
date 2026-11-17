import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { type CurrentUser, CurrentUserParam } from '../auth/current-user.decorator';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants')
@UseGuards(AuthGuard)
export class RestaurantsController {
  constructor(@Inject(RestaurantsService) private readonly service: RestaurantsService) {}

  @Get()
  list(@CurrentUserParam() user: CurrentUser, @Query('fulfilment') fulfilment: string) {
    if (fulfilment !== 'delivery' && fulfilment !== 'pickup') {
      throw new BadRequestException('fulfilment must be delivery or pickup');
    }
    return this.service.listForFulfilment(user, fulfilment);
  }

  @Get(':id/delivery-area')
  getDeliveryArea(@CurrentUserParam() user: CurrentUser, @Param('id') id: string) {
    return this.service.getDeliveryArea(user, id);
  }

  @Put(':id/delivery-area')
  setDeliveryArea(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: { deliveryRadiusKm?: unknown } | undefined,
  ) {
    return this.service.setDeliveryRadius(user, id, body?.deliveryRadiusKm);
  }
}
