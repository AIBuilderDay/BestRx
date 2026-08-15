/**
 * Smart search: ask the model to re-order catalog offers for a query and
 * (optionally) a sanitized patient. Structured output with the offer ids
 * locked in a schema enum — the model cannot answer with an id we don't have.
 *
 * Contract with callers: on ANY failure this throws, and the caller keeps the
 * deterministic order it already has. AI is an enhancement, never a dependency.
 */

import type { CatalogProductVM } from '../catalog';
import type { RerankResult } from '../../types/ai';
import type { SanitizedPatient } from './sanitize';
import { AI_MODEL, getAiClient } from './client';
import { recordUsage } from './usage';

const SYSTEM_PROMPT = `You rank durable medical equipment offers for a hospice nurse's search.
Order the offers best-first for THIS query and, when given, THIS patient. Weigh, in roughly this order:
1. Clinical fit for the query and the patient's diagnosis, age, and status.
2. Delivery speed — a patient pending discharge needs equipment before the discharge time; closer ZIP and shorter lead time win.
3. Nurse rating, then price.
Only use the data provided. Never invent products, prices, or delivery times.
Give a short plain-English reason (max 12 words) for each of your top choices; reasons must only cite facts present in the data.
Reasons are read by nurses — never mention internal ids like OFR-001; name products or vendors instead.`;

/** Compact, stable view of an offer — everything the model may consider, nothing else. */
function offerFacts(item: CatalogProductVM) {
  return {
    offerId: item.offer.id,
    product: item.offer.productName,
    description: item.offer.description,
    category: item.offer.category,
    priceUsd: item.offer.priceUsd,
    priceUnit: item.offer.unit,
    inStock: item.offer.inStock,
    deliveryEtaHours: item.offer.deliveryEtaHours,
    deliveryLeadDays: item.offer.deliveryLeadDays,
    vendor: item.vendor.name,
    nurseRating: item.rating ? { avg: item.rating.average, count: item.rating.count } : null,
  };
}

function rankingSchema(offerIds: string[]) {
  return {
    type: 'object',
    properties: {
      ranking: {
        type: 'array',
        description: 'Every offer id, best match first.',
        items: {
          type: 'object',
          properties: {
            offerId: { type: 'string', enum: offerIds },
            reason: { type: 'string', description: 'Short plain-English why, max 12 words.' },
          },
          required: ['offerId', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['ranking'],
    additionalProperties: false,
  } as const;
}

/**
 * Pure + testable: turn the model's ranking into a safe permutation of the
 * input ids — drop unknowns and duplicates, append anything it forgot.
 */
export function applyRanking(
  inputIds: string[],
  modelRanking: { offerId: string; reason: string }[],
): RerankResult {
  const valid = new Set(inputIds);
  const seen = new Set<string>();
  const orderedOfferIds: string[] = [];
  const reasons: Record<string, string> = {};
  for (const entry of modelRanking) {
    if (!valid.has(entry.offerId) || seen.has(entry.offerId)) continue;
    seen.add(entry.offerId);
    orderedOfferIds.push(entry.offerId);
    if (entry.reason.trim()) reasons[entry.offerId] = entry.reason.trim();
  }
  for (const id of inputIds) {
    if (!seen.has(id)) orderedOfferIds.push(id);
  }
  return { orderedOfferIds, reasons };
}

export async function rerankOffers(
  query: string,
  items: CatalogProductVM[],
  patient: SanitizedPatient | null,
): Promise<RerankResult> {
  const offerIds = items.map((it) => it.offer.id);
  if (offerIds.length === 0) return { orderedOfferIds: [], reasons: {} };

  const startedAt = performance.now();
  try {
    const response = await getAiClient().messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: rankingSchema(offerIds) } },
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            offers: items.map(offerFacts),
            query,
            patient, // sanitized: no name, no DOB, ZIP-level location only
          }),
        },
      ],
    });

    recordUsage({
      feature: 'rerank',
      model: AI_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Math.round(performance.now() - startedAt),
      ok: true,
    });

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('rerank: no text block in response');
    const parsed: unknown = JSON.parse(text.text);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as { ranking?: unknown }).ranking)
    ) {
      throw new Error('rerank: response did not match schema');
    }
    return applyRanking(offerIds, (parsed as { ranking: { offerId: string; reason: string }[] }).ranking);
  } catch (error) {
    recordUsage({
      feature: 'rerank',
      model: AI_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Math.round(performance.now() - startedAt),
      ok: false,
    });
    throw error; // caller falls back to the deterministic order
  }
}
