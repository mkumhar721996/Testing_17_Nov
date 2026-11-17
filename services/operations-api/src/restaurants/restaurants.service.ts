import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.decorator';
import { type Fulfilment, RestaurantsRepository } from './restaurants.repository';

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 50;

@Injectable()
export class RestaurantsService {
  constructor(@Inject(RestaurantsRepository) private readonly repo: RestaurantsRepository) {}

  async getDeliveryArea(user: CurrentUser, restaurantId: string) {
    const restaurant = await this.requireManaged(user, restaurantId);
    return {
      address: restaurant.address,
      deliveryRadiusKm: restaurant.deliveryRadiusKm,
      measuredFrom: 'straight-line' as const,
    };
  }

  async setDeliveryRadius(user: CurrentUser, restaurantId: string, km: unknown) {
    await this.requireManager(user, restaurantId);
    if (
      typeof km !== 'number' ||
      !Number.isInteger(km) ||
      km < MIN_RADIUS_KM ||
      km > MAX_RADIUS_KM
    ) {
      throw new BadRequestException(
        `Delivery radius must be a whole number from ${MIN_RADIUS_KM} to ${MAX_RADIUS_KM} km`,
      );
    }
    // The save re-checks the manager in the same statement, so a manager removed
    // since the check above cannot still write.
    const saved = await this.repo.saveDeliveryRadius(user.tenantId, restaurantId, km, user.userId);
    if (!saved) throw new ForbiddenException('Not a manager of this restaurant');
    return { deliveryRadiusKm: km };
  }

  listForFulfilment(user: CurrentUser, fulfilment: Fulfilment) {
    return this.repo.list(user.tenantId, fulfilment);
  }

  // Manager first: a missing and an unmanaged restaurant both answer 403, so callers
  // cannot probe which restaurant ids exist.
  private async requireManager(user: CurrentUser, restaurantId: string) {
    if (!(await this.repo.isManager(user.tenantId, restaurantId, user.userId))) {
      throw new ForbiddenException('Not a manager of this restaurant');
    }
  }

  private async requireManaged(user: CurrentUser, restaurantId: string) {
    await this.requireManager(user, restaurantId);
    const restaurant = await this.repo.findRestaurant(user.tenantId, restaurantId);
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }
}
