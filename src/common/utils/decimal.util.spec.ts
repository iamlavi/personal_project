import {
  addDecimal,
  formatDecimal,
  isGreaterOrEqual,
  subtractDecimal,
  toDecimalString,
} from './decimal.util';

describe('decimal.util', () => {
  it('should format values to two decimal places', () => {
    expect(toDecimalString(10)).toBe('10.00');
    expect(formatDecimal('10.5')).toBe('10.50');
  });

  it('should add and subtract without drift', () => {
    expect(addDecimal('100.00', '50.00')).toBe('150.00');
    expect(subtractDecimal('100.00', '40.00')).toBe('60.00');
  });

  it('should compare decimal strings', () => {
    expect(isGreaterOrEqual('100.00', '50.00')).toBe(true);
    expect(isGreaterOrEqual('50.00', '100.00')).toBe(false);
    expect(isGreaterOrEqual('50.00', '50.00')).toBe(true);
  });
});
