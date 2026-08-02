import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { OrderSide } from '../models/order.model';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  ticker: string;

  @IsEnum(['buy', 'sell'])
  side: OrderSide;

  @IsNumber()
  @Min(0)
  shares: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsDateString()
  executedAt?: string;
}
