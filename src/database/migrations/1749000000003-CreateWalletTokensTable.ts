/** Migration 3/4 — wallet_tokens table with lifecycle columns and max-3 trigger. */
import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { idColumn, timestampColumns } from '../migration-columns';

export class CreateWalletTokensTable1749000000003 implements MigrationInterface {
  name = 'CreateWalletTokensTable1749000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'wallet_tokens',
        columns: [
          idColumn(),
          {
            name: 'walletId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'token',
            type: 'varchar',
            length: '64',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'expiresAt',
            type: 'timestamptz',
            isNullable: true,
          },
          ...timestampColumns(),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'wallet_tokens',
      new TableIndex({
        name: 'idx_wallet_tokens_wallet_id',
        columnNames: ['walletId'],
      }),
    );

    await queryRunner.createForeignKey(
      'wallet_tokens',
      new TableForeignKey({
        name: 'FK_wallet_tokens_wallet',
        columnNames: ['walletId'],
        referencedTableName: 'wallets',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_wallet_active_token_limit()
      RETURNS TRIGGER AS $$
      DECLARE
        active_count integer;
      BEGIN
        SELECT COUNT(*) INTO active_count
        FROM wallet_tokens
        WHERE "walletId" = NEW."walletId"
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW());

        IF active_count >= 3 THEN
          RAISE EXCEPTION 'Maximum wallet tokens reached';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_wallet_token_limit
      BEFORE INSERT ON wallet_tokens
      FOR EACH ROW
      EXECUTE PROCEDURE check_wallet_active_token_limit()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_wallet_token_limit ON wallet_tokens`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS check_wallet_active_token_limit`,
    );
    await queryRunner.dropForeignKey(
      'wallet_tokens',
      'FK_wallet_tokens_wallet',
    );
    await queryRunner.dropIndex('wallet_tokens', 'idx_wallet_tokens_wallet_id');
    await queryRunner.dropTable('wallet_tokens');
  }
}
