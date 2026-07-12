import { PartialType, PickType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

/**
 * Editable order fields (only allowed while status = draft). All optional;
 * location/price recompute happens in the service when addresses change.
 */
export class UpdateOrderDto extends PartialType(
  PickType(CreateOrderDto, [
    'pickupAddress',
    'pickupLat',
    'pickupLng',
    'deliveryAddress',
    'deliveryLat',
    'deliveryLng',
    'description',
    'packagePhoto',
    'weightKg',
    'dimensions',
    'scheduledTime',
  ] as const),
) {}
