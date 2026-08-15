/**
 * The deterministic half of agent ordering: does this AI-mode input read as a command?
 *
 * No model call — this is the router that decides whether Enter runs the ordering agent or an
 * AI-ranked search. The agent itself lives on the backend (backend/app/ai/agent.py); the browser
 * reaches it through `runAgentOrder` in ./client.
 */

/** True when the input opens with a verb that reads as "put something in my cart". */
export function looksLikeOrderCommand(text: string): boolean {
  return /^\s*(order|add|get|buy|send|place)\b/i.test(text);
}
