import { describe, expect, it } from 'vitest';
import { looksLikeOrderCommand } from './agentOrder';

// The ranking, validation, sanitization, and ledger tests moved to backend/tests/test_ai.py along
// with the code they cover: the model calls now happen on the API. What is left in the browser is
// the deterministic router below, which decides whether Enter runs the agent or an AI search.

describe('looksLikeOrderCommand', () => {
  it('routes order-style commands to the agent', () => {
    expect(looksLikeOrderCommand('order a hospital bed for Harold')).toBe(true);
    expect(looksLikeOrderCommand('  Add a wheelchair for Maria')).toBe(true);
    expect(looksLikeOrderCommand('Buy a walker for Mr. Chen')).toBe(true);
  });

  it('routes questions and searches to re-rank', () => {
    expect(looksLikeOrderCommand('best bed for a bariatric patient')).toBe(false);
    expect(looksLikeOrderCommand('oxygen concentrator')).toBe(false);
    // "ordered" is not "order" — the boundary keeps a search for past orders out of the agent.
    expect(looksLikeOrderCommand('ordered beds last week')).toBe(false);
  });
});
