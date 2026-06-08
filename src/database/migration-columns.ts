import { TableColumnOptions } from 'typeorm';

export const idColumn = (): TableColumnOptions => ({
  name: 'id',
  type: 'uuid',
  isPrimary: true,
  default: 'uuid_generate_v4()',
});

export const createdAtColumn = (): TableColumnOptions => ({
  name: 'createdAt',
  type: 'timestamptz',
  default: 'now()',
  isNullable: false,
});

export const updatedAtColumn = (): TableColumnOptions => ({
  name: 'updatedAt',
  type: 'timestamptz',
  default: 'now()',
  isNullable: false,
});

/** createdAt + updatedAt — append after domain columns */
export const timestampColumns = (): TableColumnOptions[] => [
  createdAtColumn(),
  updatedAtColumn(),
];
