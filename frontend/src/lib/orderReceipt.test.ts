import { describe, expect, it } from 'vitest';
import { buildOrderReceiptVM, receiptTotalLabel } from './orderReceipt';

describe('buildOrderReceiptVM', () => {
  it('builds receipt from a known order with vendor pricing', () => {
    const receipt = buildOrderReceiptVM('DME-10231');
    expect(receipt).not.toBeNull();
    expect(receipt?.orderId).toBe('DME-10231');
    expect(receipt?.lines).toHaveLength(1);
    expect(receipt?.lines[0].hcpcs).toBe('E0250');
    expect(receipt?.lines[0].unitPriceUsd).toBeGreaterThan(0);
    expect(receiptTotalLabel(receipt!)).toContain('$');
  });

  it('prices Affinity Home Medical wheelchair orders from vendor offers', () => {
    const receipt = buildOrderReceiptVM('DME-10363');
    expect(receipt?.lines[0].unitPriceUsd).toBe(66);
    expect(receiptTotalLabel(receipt!)).toBe('$66/mo');
  });

  it('returns null for unknown order', () => {
    expect(buildOrderReceiptVM('DME-UNKNOWN')).toBeNull();
  });
});
