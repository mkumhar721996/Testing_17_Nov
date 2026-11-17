import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Caller, MENU_REPOSITORY, Menu, MenuItem, MenuRepository, MenuSection } from './menu.repository';
import { parsePrice } from './price';

const MAX_SECTION_NAME = 60;
const MAX_ITEM_NAME = 120;
const MAX_DESCRIPTION = 500;

type Errors = { name?: string; price?: string; description?: string };

function parseName(raw: unknown, max: number, errors: Errors): string | undefined {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) {
    errors.name = 'Enter a name.';
  } else if (name.length > max) {
    errors.name = `Use at most ${max} characters.`;
  } else {
    return name;
  }
  return undefined;
}

function parseDescription(raw: unknown, errors: Errors): string | undefined {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string' || raw.length > MAX_DESCRIPTION) {
    errors.description = `Use at most ${MAX_DESCRIPTION} characters.`;
    return undefined;
  }
  return raw.trim();
}

function fail(errors: Errors): never {
  throw new BadRequestException({ errors });
}

function rejectUnknown(body: Record<string, unknown> | undefined, allowed: string[]) {
  const input = body ?? {};
  const unknown = Object.keys(input).filter((k) => !allowed.includes(k));
  if (unknown.length) {
    throw new BadRequestException({ message: `Unknown properties: ${unknown.join(', ')}` });
  }
  return input;
}

@Injectable()
export class MenuService {
  constructor(@Inject(MENU_REPOSITORY) private readonly repo: MenuRepository) {}

  /** Same refusal for a non-manager and for another restaurant's manager: no existence leak. */
  private async requireManager(caller: Caller, restaurantId: string) {
    if (!(await this.repo.isManager(caller, restaurantId))) {
      throw new ForbiddenException();
    }
  }

  async getMenu(restaurantId: string): Promise<Menu> {
    const menu = await this.repo.getMenu(restaurantId);
    if (!menu) throw new NotFoundException();
    return menu;
  }

  async addSection(caller: Caller, restaurantId: string, body: Record<string, unknown>) {
    await this.requireManager(caller, restaurantId);
    const input = rejectUnknown(body, ['name']);
    const errors: Errors = {};
    const name = parseName(input.name, MAX_SECTION_NAME, errors);
    if (name === undefined) fail(errors);
    return this.repo.addSection(caller, restaurantId, name);
  }

  async renameSection(
    caller: Caller,
    restaurantId: string,
    sectionId: string,
    body: Record<string, unknown>,
  ): Promise<MenuSection> {
    await this.requireManager(caller, restaurantId);
    const input = rejectUnknown(body, ['name']);
    const errors: Errors = {};
    const name = parseName(input.name, MAX_SECTION_NAME, errors);
    if (name === undefined) fail(errors);
    const section = await this.repo.renameSection(caller, restaurantId, sectionId, name);
    if (!section) throw new NotFoundException();
    return section;
  }

  async removeSection(caller: Caller, restaurantId: string, sectionId: string) {
    await this.requireManager(caller, restaurantId);
    const result = await this.repo.removeSection(caller, restaurantId, sectionId);
    if (result === 'not-found') throw new NotFoundException();
    if (result === 'has-items') {
      throw new ConflictException('This section still has items. Remove its items first.');
    }
  }

  async addItem(
    caller: Caller,
    restaurantId: string,
    sectionId: string,
    body: Record<string, unknown>,
  ): Promise<MenuItem> {
    await this.requireManager(caller, restaurantId);
    const input = rejectUnknown(body, ['name', 'description', 'price']);
    const errors: Errors = {};
    const name = parseName(input.name, MAX_ITEM_NAME, errors);
    const description = parseDescription(input.description, errors);
    const price = parsePrice(input.price);
    if (!price.ok) errors.price = price.error;
    if (name === undefined || description === undefined || !price.ok) fail(errors);
    const item = await this.repo.addItem(caller, restaurantId, sectionId, {
      name,
      description,
      price: price.price,
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  async updateItem(
    caller: Caller,
    restaurantId: string,
    itemId: string,
    body: Record<string, unknown>,
  ): Promise<MenuItem> {
    await this.requireManager(caller, restaurantId);
    const input = rejectUnknown(body, ['name', 'description', 'price']);
    const errors: Errors = {};
    const patch: { name?: string; description?: string; price?: string } = {};
    if ('name' in input) patch.name = parseName(input.name, MAX_ITEM_NAME, errors);
    if ('description' in input) patch.description = parseDescription(input.description, errors);
    if ('price' in input) {
      const price = parsePrice(input.price);
      if (price.ok) patch.price = price.price;
      else errors.price = price.error;
    }
    if (Object.keys(errors).length) fail(errors);
    const item = await this.repo.updateItem(caller, restaurantId, itemId, patch);
    if (!item) throw new NotFoundException();
    return item;
  }

  async removeItem(caller: Caller, restaurantId: string, itemId: string) {
    await this.requireManager(caller, restaurantId);
    if (!(await this.repo.removeItem(caller, restaurantId, itemId))) throw new NotFoundException();
  }
}
