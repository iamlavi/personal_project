/** Migration 2/4 — wallets table, one per customer (unique customerId FK). */
import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';
import { idColumn, timestampColumns } from '../migration-columns';

export class CreateWalletsTable1749000000002 implements MigrationInterface {
  name = 'CreateWalletsTable1749000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'wallets',
        columns: [
          idColumn(),
          {
            name: 'customerId',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'balance',
            type: 'decimal',
            precision: 18,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          ...timestampColumns(),
        ],
      }),
      true,
    );

    const walletsTable = await queryRunner.getTable('wallets');
    const hasFk = walletsTable?.foreignKeys.some(
      (fk) => fk.name === 'FK_wallets_customer',
    );
    if (hasFk) {
      return;
    }

    await queryRunner.createForeignKey(
      'wallets',
      new TableForeignKey({
        name: 'FK_wallets_customer',
        columnNames: ['customerId'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('wallets', 'FK_wallets_customer');
    await queryRunner.dropTable('wallets');
  }
}
