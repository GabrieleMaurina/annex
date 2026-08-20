import { Server, Socket } from 'socket.io';
import { Player } from '../../types';
import { isNullableInteger, isObject } from '../../validate';
import { evaluateCardSelection, returnCardsToDeck } from '../logic/cards';
import { gameState } from '../logic/state';
import { gameRoomName, games } from '../logic/store';

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function registerCardHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:playCardSet',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.state !== 'playing')
        return callback({ ok: false, error: 'game not started' });
      if (game.playerIds[game.turnPlayerIndex] !== player.id)
        return callback({ ok: false, error: 'not your turn' });
      if (game.turnPhase !== 'deploy')
        return callback({ ok: false, error: 'not deploy phase' });

      const cards = isObject(data) ? data.cards : undefined;
      if (
        !Array.isArray(cards) ||
        cards.length !== 3 ||
        !cards.every((c) => isNullableInteger(c))
      )
        return callback({ ok: false, error: 'invalid cards' });

      const hand = game.playerCards.get(player.id) ?? [];
      const evaluated = evaluateCardSelection(game, hand, player.id, cards);
      if (!evaluated) return callback({ ok: false, error: 'invalid set' });

      for (const used of evaluated.cards) {
        const index = hand.indexOf(used);
        if (index !== -1) hand.splice(index, 1);
      }
      returnCardsToDeck(game.deck, evaluated.cards);

      game.troopsToDeploy += evaluated.baseValue;
      for (const territoryId of evaluated.territoryBonusIds) {
        game.territoryTroops.set(
          territoryId,
          (game.territoryTroops.get(territoryId) ?? 0) + 2,
        );
      }
      game.cardSetsPlayed++;
      if (game.cards === 'Exponential')
        game.cardsLastSetValue = evaluated.baseValue;

      io.to(gameRoomName(game.name)).emit('game:cardSetPlayed', {
        playerId: player.id,
        troops: evaluated.totalValue,
        cards: evaluated.cards,
      });
      for (const territoryId of evaluated.territoryBonusIds) {
        io.to(gameRoomName(game.name)).emit('game:deployed', {
          territoryId,
          troops: 2,
        });
      }

      callback({ ok: true, game: gameState(game, playersById) });
    },
  );
}
