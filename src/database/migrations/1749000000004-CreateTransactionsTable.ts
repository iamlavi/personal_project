/** Migration 4/4 — transactions ledger + enum types for type and status. */
import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { createdAtColumn, idColumn } from '../migration-columns';

export class CreateTransactionsTable1749000000004 implements MigrationInterface {
  name = 'CreateTransactionsTable1749000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "transactions_type_enum" AS ENUM('DEPOSIT', 'WITHDRAWAL')
    `);

    await queryRunner.query(`
      CREATE TYPE "transactions_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'transactions',
        columns: [
          idColumn(),
          {
            name: 'walletId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'transactions_type_enum',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'transactions_status_enum',
            default: `'PENDING'`,
            isNullable: false,
          },
          {
            name: 'failureReason',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'balanceBefore',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'balanceAfter',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: false,
          },
          createdAtColumn(),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'idx_transactions_wallet_id',
        columnNames: ['walletId'],
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'idx_transactions_wallet_created',
        columnNames: ['walletId', 'createdAt'],
      }),
    );

    await queryRunner.createForeignKey(
      'transactions',
      new TableForeignKey({
        name: 'FK_transactions_wallet',
        columnNames: ['walletId'],
        referencedTableName: 'wallets',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('transactions', 'FK_transactions_wallet');
    await queryRunner.dropIndex(
      'transactions',
      'idx_transactions_wallet_created',
    );
    await queryRunner.dropIndex('transactions', 'idx_transactions_wallet_id');
    await queryRunner.dropTable('transactions');
    await queryRunner.query(`DROP TYPE "transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "transactions_type_enum"`);
  }
}
