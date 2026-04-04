import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_KEY = 'ownership';
export const Ownership = (resource: 'journal') =>
  SetMetadata(OWNERSHIP_KEY, resource);
