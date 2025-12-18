import { IsArray, ValidateNested, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ColumnOrder {
  @IsUUID('4')
  columnId!: string;

  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderColumnsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnOrder)
  columnOrders!: ColumnOrder[];
}
