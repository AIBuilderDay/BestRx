import { useEffect, useRef, useState } from 'react';
import type { CatalogProductVM } from '../lib/catalog';
import type { RerankResult } from '../types/ai';
import { rerankOffers } from '../lib/ai/client';

export interface AiRerankState {
  /** Model finished: offer ids best-first (a safe permutation of the input). */
  result: RerankResult | null;
  /** True while the model is thinking — deterministic results stay on screen. */
  busy: boolean;
  /** True when the call failed and the view should use the plain keyword search. */
  failed: boolean;
  /** Display label of the patient whose context was used, when the query named one. */
  patientLabel: string | null;
}

const IDLE: AiRerankState = { result: null, busy: false, failed: false, patientLabel: null };

/**
 * Runs the AI re-rank when the catalog is in AI-search mode.
 *
 * Only offer ids go up: the API joins the vendor, price, and rating facts itself from the same
 * fixtures it serves, so a search costs a list of ids rather than the whole storefront. Patient
 * matching also happens there — names never leave the API, and only a sanitized patient reaches
 * the model. Stale responses are dropped.
 */
export function useAiRerank(
  enabled: boolean,
  query: string,
  items: CatalogProductVM[],
  hospiceId: string | null,
): AiRerankState {
  const [state, setState] = useState<AiRerankState>(IDLE);
  const runRef = useRef(0);

  useEffect(() => {
    if (!enabled || !query.trim() || items.length === 0) {
      setState(IDLE);
      return;
    }
    const run = ++runRef.current;
    const offerIds = items.map((it) => it.offer.id);
    setState({ result: null, busy: true, failed: false, patientLabel: null });

    rerankOffers(query, offerIds, hospiceId)
      .then(({ orderedOfferIds, reasons, patientLabel }) => {
        if (runRef.current !== run) return;
        setState({ result: { orderedOfferIds, reasons }, busy: false, failed: false, patientLabel });
      })
      .catch(() => {
        if (runRef.current !== run) return;
        setState({ result: null, busy: false, failed: true, patientLabel: null });
      });
  }, [enabled, query, items, hospiceId]);

  return state;
}
