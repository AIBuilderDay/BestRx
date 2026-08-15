import { useEffect, useRef, useState } from 'react';
import type { Patient } from '../types/domain';
import type { CatalogProductVM } from '../lib/catalog';
import type { RerankResult } from '../types/ai';
import { rerankOffers } from '../lib/ai/rerank';
import { findMentionedPatients, sanitizePatient } from '../lib/ai/sanitize';

export interface AiRerankState {
  /** Model finished: offer ids best-first (a safe permutation of the input). */
  result: RerankResult | null;
  /** True while the model is thinking — deterministic results stay on screen. */
  busy: boolean;
  /** True when the call failed and the view should use the plain keyword search. */
  failed: boolean;
  /** Display label of the patient whose context was used, when one was named. */
  patientLabel: string | null;
}

const IDLE: AiRerankState = { result: null, busy: false, failed: false, patientLabel: null };

/**
 * Runs the AI re-rank when the catalog is in AI-search mode. If the query names
 * a patient (matched client-side — names never go to the model for matching),
 * their sanitized context rides along. Stale responses are dropped.
 */
export function useAiRerank(
  enabled: boolean,
  query: string,
  items: CatalogProductVM[],
  patientPool: Patient[],
): AiRerankState {
  const [state, setState] = useState<AiRerankState>(IDLE);
  const runRef = useRef(0);

  useEffect(() => {
    if (!enabled || !query.trim() || items.length === 0) {
      setState(IDLE);
      return;
    }
    const run = ++runRef.current;
    const mentioned = findMentionedPatients(query, patientPool);
    const patient = mentioned.length === 1 ? sanitizePatient(mentioned[0]) : null;
    setState({ result: null, busy: true, failed: false, patientLabel: patient?.label ?? null });

    rerankOffers(query, items, patient)
      .then((result) => {
        if (runRef.current !== run) return;
        setState({ result, busy: false, failed: false, patientLabel: patient?.label ?? null });
      })
      .catch(() => {
        if (runRef.current !== run) return;
        setState({ result: null, busy: false, failed: true, patientLabel: null });
      });
  }, [enabled, query, items, patientPool]);

  return state;
}
