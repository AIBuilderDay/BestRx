/**
 * Agent ordering: parse "order a hospital bed for Harold" into a structured,
 * validated action — which offer, which patient, how many. Single-shot slot
 * filling with ids locked in schema enums; NO_MATCH is an explicit option so
 * the model can say "I can't resolve this" instead of guessing.
 *
 * The agent only fills the cart. A human always reviews and confirms checkout.
 * On ANY failure callers show plain search results instead — never a dead end.
 */

import type { Patient } from '../../types/domain';
import type { CatalogProductVM } from '../catalog';
import type { AgentOrderAction } from '../../types/ai';
import { AI_MODEL, getAiClient } from './client';
import { recordUsage } from './usage';
import { sanitizePatient } from './sanitize';

const NO_MATCH = 'NO_MATCH';
const MAX_QTY = 10;

const SYSTEM_PROMPT = `You turn a hospice nurse's plain-English order command into one structured cart action.
Pick the single offer that best matches the equipment asked for (prefer in-stock, faster delivery, better rating, then lower price when several fit) and the single patient the command refers to.
If the command states an explicit preference — cheapest, a specific vendor, fastest delivery — that preference overrides the defaults above.
Patients are listed with a short label like "Harold B." — match on that. If the command does not clearly identify a listed patient or a matching product, answer ${NO_MATCH} for that field instead of guessing.
Quantity defaults to 1 unless the command says otherwise.
"summary" is one sentence a nurse can skim to confirm what you understood, e.g. "Add 1 Hospital Bed (Sample Vendor 1) for Harold B."`;

function actionSchema(offerIds: string[], patientIds: string[]) {
  return {
    type: 'object',
    properties: {
      offerId: { type: 'string', enum: [...offerIds, NO_MATCH] },
      patientId: { type: 'string', enum: [...patientIds, NO_MATCH] },
      quantity: { type: 'integer' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      summary: { type: 'string' },
    },
    required: ['offerId', 'patientId', 'quantity', 'confidence', 'summary'],
    additionalProperties: false,
  } as const;
}

interface RawAction {
  offerId: string;
  patientId: string;
  quantity: number;
  confidence: 'high' | 'medium' | 'low';
  summary: string;
}

/** Pure + testable: reject anything the app can't safely act on. Returns null when unusable. */
export function validateAction(
  raw: RawAction,
  offerIds: string[],
  patientIds: string[],
): AgentOrderAction | null {
  if (raw.offerId === NO_MATCH || raw.patientId === NO_MATCH) return null;
  if (!offerIds.includes(raw.offerId) || !patientIds.includes(raw.patientId)) return null;
  const quantity = Math.floor(raw.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) return null;
  return {
    offerId: raw.offerId,
    patientId: raw.patientId,
    quantity,
    confidence: raw.confidence,
    summary: raw.summary.trim() || 'Add item to cart',
  };
}

export async function parseAgentOrder(
  command: string,
  items: CatalogProductVM[],
  patients: Patient[],
): Promise<AgentOrderAction | null> {
  const offerIds = items.map((it) => it.offer.id);
  const patientIds = patients.map((p) => p.id);
  if (offerIds.length === 0 || patientIds.length === 0) return null;

  const startedAt = performance.now();
  try {
    const response = await getAiClient().messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: 'json_schema', schema: actionSchema(offerIds, patientIds) },
      },
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            offers: items.map((it) => ({
              offerId: it.offer.id,
              product: it.offer.productName,
              description: it.offer.description,
              category: it.offer.category,
              vendor: it.vendor.name,
              rentalPriceUsd: it.offer.rentalPriceUsd ?? null,
              purchasePriceUsd: it.offer.purchasePriceUsd ?? null,
              priceUnit: it.offer.unit,
              inStock: it.offer.inStock,
              deliveryLeadDays: it.offer.deliveryLeadDays,
              nurseRating: it.rating ? { avg: it.rating.average, count: it.rating.count } : null,
            })),
            patients: patients.map(sanitizePatient),
            command,
          }),
        },
      ],
    });

    recordUsage({
      feature: 'agent_order',
      model: AI_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Math.round(performance.now() - startedAt),
      ok: true,
    });

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('agent order: no text block in response');
    const raw = JSON.parse(text.text) as RawAction;
    return validateAction(raw, offerIds, patientIds);
  } catch (error) {
    recordUsage({
      feature: 'agent_order',
      model: AI_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Math.round(performance.now() - startedAt),
      ok: false,
    });
    throw error; // caller falls back to plain search
  }
}

/** Deterministic router: does this AI-mode input read as an order command? No model call. */
export function looksLikeOrderCommand(text: string): boolean {
  return /^\s*(order|add|get|buy|send|place)\b/i.test(text);
}
