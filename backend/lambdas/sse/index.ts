/**
 * SSE streamer.
 *
 * A Lambda Function URL in RESPONSE_STREAM mode holds the connection open and emits order events as
 * they land in DynamoDB. This is the live channel: it updates a tab that is already open. The push
 * Lambda covers the case where it is not.
 *
 * Written in TypeScript because response streaming is only supported on the Node runtime — the rest
 * of the backend is Python.
 *
 * Two limits worth knowing, both handled rather than hidden:
 * - It polls, so latency is one poll interval (~2s), not instant.
 * - Lambda caps at 15 minutes. We close cleanly before then and the browser's EventSource
 *   reconnects on its own, sending Last-Event-ID so the stream resumes without a gap.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const EVENTS_TABLE = process.env.ORDER_EVENTS_TABLE ?? '';
const STREAM_PARTITION = 'ALL';

const POLL_INTERVAL_MS = 2_000;
/** Well inside Lambda's 15-minute ceiling, so the close is ours and not a timeout. */
const MAX_CONNECTION_MS = 13 * 60 * 1_000;
/** Without traffic, proxies drop an idle connection. A comment frame keeps it alive. */
const HEARTBEAT_MS = 15_000;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface OrderEvent {
  seq: number;
  id: string;
  orderId: string;
  at: string;
  event: string;
  actorId: string | null;
  detail: string;
}

/** Lambda's streaming global, present only in the Node runtime. */
declare const awslambda: {
  streamifyResponse: (
    handler: (event: LambdaUrlEvent, responseStream: ResponseStream) => Promise<void>,
  ) => unknown;
  HttpResponseStream: {
    from: (stream: ResponseStream, metadata: ResponseMetadata) => ResponseStream;
  };
};

interface ResponseStream {
  write: (chunk: string) => void;
  end: () => void;
}

interface ResponseMetadata {
  statusCode: number;
  headers: Record<string, string>;
}

interface LambdaUrlEvent {
  queryStringParameters?: Record<string, string | undefined> | null;
  headers?: Record<string, string | undefined> | null;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Where to resume from.
 *
 * Last-Event-ID wins: the browser sets it automatically on reconnect, and honouring it is what makes
 * a reconnect seamless. A `since` query param is the manual equivalent for a first connection.
 */
function resolveCursor(event: LambdaUrlEvent): number {
  const headers = event.headers ?? {};
  const lastEventId = headers['last-event-id'] ?? headers['Last-Event-ID'];
  const since = event.queryStringParameters?.since;

  for (const candidate of [lastEventId, since]) {
    if (candidate) {
      const parsed = Number.parseInt(candidate, 10);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return 0;
}

async function fetchEventsSince(seq: number, limit = 100): Promise<OrderEvent[]> {
  const response = await client.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      IndexName: 'by-seq',
      KeyConditionExpression: '#stream = :stream AND #seq > :seq',
      ExpressionAttributeNames: { '#stream': 'stream', '#seq': 'seq' },
      ExpressionAttributeValues: { ':stream': STREAM_PARTITION, ':seq': seq },
      ScanIndexForward: true,
      Limit: limit,
    }),
  );
  return (response.Items ?? []) as OrderEvent[];
}

function writeEvent(stream: ResponseStream, orderEvent: OrderEvent): void {
  // The id line is what the browser echoes back as Last-Event-ID.
  stream.write(`id: ${orderEvent.seq}\n`);
  stream.write('event: order-status\n');
  stream.write(`data: ${JSON.stringify(orderEvent)}\n\n`);
}

async function streamOrderEvents(
  event: LambdaUrlEvent,
  responseStream: ResponseStream,
): Promise<void> {
  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });

  const hospiceId = event.queryStringParameters?.hospiceId;
  let cursor = resolveCursor(event);

  // Tell the client where we picked up, so a stalled stream is diagnosable from the browser.
  stream.write(`event: connected\ndata: ${JSON.stringify({ cursor, hospiceId })}\n\n`);

  const startedAt = Date.now();
  let lastHeartbeat = Date.now();

  try {
    while (Date.now() - startedAt < MAX_CONNECTION_MS) {
      let events: OrderEvent[] = [];
      try {
        events = await fetchEventsSince(cursor);
      } catch (error) {
        // A transient DynamoDB error should not kill the connection; the next poll retries.
        console.error('poll failed', error);
      }

      for (const orderEvent of events) {
        // The counter row shares the table but is not an event.
        if (orderEvent.orderId === '__counter__') {
          cursor = Math.max(cursor, orderEvent.seq ?? cursor);
          continue;
        }
        if (!hospiceId || (orderEvent as { hospiceId?: string }).hospiceId === hospiceId) {
          writeEvent(stream, orderEvent);
        }
        cursor = Math.max(cursor, orderEvent.seq);
      }

      if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
        stream.write(': heartbeat\n\n');
        lastHeartbeat = Date.now();
      }

      await sleep(POLL_INTERVAL_MS);
    }

    // Out of budget. Say so, so the reconnect is expected rather than looking like a failure.
    stream.write(`event: reconnect\ndata: ${JSON.stringify({ cursor })}\n\n`);
  } finally {
    stream.end();
  }
}

export const handler = awslambda.streamifyResponse(streamOrderEvents);
