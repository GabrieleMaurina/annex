import { isRebindDisconnect, socket } from '../lib/socket';

type Handler = (payload: never) => void;

const INBOUND_EVENTS = [
  'game:state',
  'game:meta',
  'game:turnStarted',
  'game:mission',
  'game:results',
  'game:cards',
  'game:logs',
  'game:mapGenerated',
  'game:kicked',
  'game:chatMessage',
  'game:emojiSent',
  'game:selected',
  'game:tankFired',
  'game:territoryClaimed',
  'game:capitalPlacementStarted',
  'game:cardSetPlayed',
  'game:deployed',
  'game:deployedMany',
  'game:fortified',
  'game:attacked',
  'game:attackMoved',
  'game:entrenched',
  'game:toxined',
  'game:toxinExpired',
  'game:radiationUpcoming',
  'game:radiationChanged',
  'game:starved',
  'game:allianceRequested',
  'game:allianceFormed',
  'game:allianceDeclined',
  'game:allianceTerminated',
  'home:games',
];

const listeners = new Map<string, Set<Handler>>();

export function subscribe(event: string, handler: Handler): void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler);
}

export function unsubscribe(event: string, handler: Handler): void {
  listeners.get(event)?.delete(handler);
}

export function publish(event: string, payload?: unknown): void {
  for (const handler of listeners.get(event) ?? [])
    (handler as (payload?: unknown) => void)(payload);
}

for (const event of INBOUND_EVENTS)
  socket.on(event, (payload) => publish(event, payload));
socket.on('connect', () => publish('connect'));
socket.on('disconnect', (reason) => {
  if (isRebindDisconnect()) return;
  publish('disconnect', reason);
});
