import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Container, Form, ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { formatError } from '../common/formatError';
import { connector } from '../connector';
import { rankForElo } from '../lib/ranks';
import type {
  Account,
  Friend,
  FriendsOverview,
  PlayerSearchResult,
} from '../lib/types';

interface Props {
  account: Account;
}

type FriendAck = { ok: true } | { ok: false; error: string };
type FriendAction = (userId: string, cb: (res: FriendAck) => void) => void;

function RankIcon({ elo }: { elo: number }) {
  const rank = rankForElo(elo);
  return (
    <img
      src={`/ranks/${rank.image}.svg`}
      width={24}
      height={24}
      alt={rank.name}
    />
  );
}

function PersonRow({
  person,
  onOpen,
  children,
}: {
  person: Friend;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <ListGroup.Item className="d-flex align-items-center gap-2">
      <RankIcon elo={person.elo} />
      <Button
        variant="link"
        className="p-0 text-decoration-none flex-grow-1 text-start"
        onClick={onOpen}
      >
        {person.username}
      </Button>
      {children}
    </ListGroup.Item>
  );
}

function Friends({ account }: Props) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => connector.listFriends(setOverview), []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = search.trim();
    const timer = setTimeout(() => {
      if (q) connector.searchPlayers(q, setResults);
      else setResults([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  function run(action: FriendAction, userId: string, okMessage: string) {
    action(userId, (res) => {
      setNotice(res.ok ? okMessage : formatError(res.error));
      load();
    });
  }

  function open(username: string) {
    navigate(`/players/${encodeURIComponent(username)}`);
  }

  const friends = overview?.friends ?? [];
  const incoming = overview?.incoming ?? [];
  const outgoing = overview?.outgoing ?? [];
  const relationship = new Map<string, string>([
    ...friends.map((f): [string, string] => [f.id, 'Friends']),
    ...outgoing.map((f): [string, string] => [f.id, 'Requested']),
    ...incoming.map((f): [string, string] => [f.id, 'Wants to be friends']),
  ]);

  return (
    <Container fluid className="py-5 px-2 px-sm-4" style={{ maxWidth: 640 }}>
      <h1 className="text-center mb-4">Friends</h1>

      {notice && (
        <Alert
          variant="info"
          className="py-1 px-2 small"
          dismissible
          onClose={() => setNotice('')}
        >
          {notice}
        </Alert>
      )}

      <h2 className="h5 mt-4">Find players</h2>
      <Form.Control
        size="sm"
        placeholder="Search by username"
        maxLength={10}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {results.length > 0 && (
        <ListGroup className="mt-2">
          {results
            .filter(
              (r) =>
                r.username.toLowerCase() !== account.username.toLowerCase(),
            )
            .map((r) => (
              <ListGroup.Item
                key={r.id}
                className="d-flex align-items-center gap-2"
              >
                <Button
                  variant="link"
                  className="p-0 text-decoration-none flex-grow-1 text-start"
                  onClick={() => open(r.username)}
                >
                  {r.username}
                </Button>
                {relationship.has(r.id) ? (
                  <span className="small text-muted">
                    {relationship.get(r.id)}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      run(
                        connector.sendFriendRequest,
                        r.id,
                        'Friend request sent.',
                      )
                    }
                  >
                    Add friend
                  </Button>
                )}
              </ListGroup.Item>
            ))}
        </ListGroup>
      )}

      {incoming.length > 0 && (
        <>
          <h2 className="h5 mt-4">Requests</h2>
          <ListGroup>
            {incoming.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                onOpen={() => open(person.username)}
              >
                <Button
                  size="sm"
                  onClick={() =>
                    run(
                      connector.acceptFriendRequest,
                      person.id,
                      'Friend added.',
                    )
                  }
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() =>
                    run(connector.removeFriend, person.id, 'Request rejected.')
                  }
                >
                  Reject
                </Button>
              </PersonRow>
            ))}
          </ListGroup>
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <h2 className="h5 mt-4">Sent requests</h2>
          <ListGroup>
            {outgoing.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                onOpen={() => open(person.username)}
              >
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() =>
                    run(connector.removeFriend, person.id, 'Request cancelled.')
                  }
                >
                  Cancel
                </Button>
              </PersonRow>
            ))}
          </ListGroup>
        </>
      )}

      <h2 className="h5 mt-4">Your friends</h2>
      {friends.length === 0 ? (
        <p className="text-muted">No friends yet.</p>
      ) : (
        <ListGroup>
          {friends.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              onOpen={() => open(person.username)}
            >
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() =>
                  run(connector.removeFriend, person.id, 'Friend removed.')
                }
              >
                Remove
              </Button>
            </PersonRow>
          ))}
        </ListGroup>
      )}
    </Container>
  );
}

export default Friends;
