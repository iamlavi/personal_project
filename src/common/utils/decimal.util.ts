/**
 * Money helpers backed by decimal.js — avoids floating-point drift.
 */
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function toDecimalString(value: number | string): string {
  return new Decimal(value).toFixed(2);
}

export function addDecimal(a: string, b: string): string {
  return new Decimal(a).plus(b).toFixed(2);
}

export function subtractDecimal(a: string, b: string): string {
  return new Decimal(a).minus(b).toFixed(2);
}

export function isGreaterOrEqual(a: string, b: string): boolean {
  return new Decimal(a).gte(b);
}

export function formatDecimal(value: string | number): string {
  return new Decimal(value).toFixed(2);
}
