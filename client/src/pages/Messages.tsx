import { containsProfanity } from 'engine';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Alert,
  Badge,
  Button,
  Col,
  Container,
  Form,
  ListGroup,
  Row,
} from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatError } from '../common/formatError';
import { connector } from '../connector';
import {
  getMessagesSnapshot,
  markConversationRead,
  refreshMessages,
  setMessagesEnabled,
  subscribeMessages,
  unreadCount,
} from '../lib/messages';
import { rankForElo } from '../lib/ranks';
import { playSound } from '../lib/sounds';
import type { Account, Conversation, PlayerSearchResult } from '../lib/types';

const MAX_LENGTH = 1000;

interface Props {
  account: Account;
}

interface Partner {
  userId: string;
  username: string;
  elo: number;
}

interface ActiveConversation extends Conversation {
  blocked: boolean;
}

function RankIcon({ elo }: { elo: number }) {
  const rank = rankForElo(elo);
  return (
    <img
      src={`/ranks/${rank.image}.svg`}
      width={20}
      height={20}
      alt={rank.name}
    />
  );
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

function Messages({ account }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const overview = useSyncExternalStore(subscribeMessages, getMessagesSnapshot);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [draft, setDraft] = useState('');
  const [hasProfanity, setHasProfanity] = useState(false);
  const [notice, setNotice] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessagesEnabled(true);
    refreshMessages();
  }, []);

  const to = params.get('to');
  useEffect(() => {
    if (!to) return;
    connector.getPlayerProfile(to, (profile) => {
      if (profile)
        setSelected({
          userId: profile.id,
          username: profile.username,
          elo: profile.elo,
        });
    });
  }, [to]);

  useEffect(() => {
    const q = search.trim();
    const timer = setTimeout(() => {
      if (q) connector.searchPlayers(q, setResults);
      else setResults([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { conversations, blocked } = overview;

  const conversation: ActiveConversation | null = useMemo(() => {
    const partner =
      selected ?? (to ? null : (overview.conversations[0] ?? null));
    if (!partner) return null;
    const existing = overview.conversations.find(
      (c) => c.userId === partner.userId,
    );
    return {
      userId: partner.userId,
      username: existing?.username ?? partner.username,
      elo: existing?.elo ?? partner.elo,
      messages: existing?.messages ?? [],
      blocked: overview.blocked.some((b) => b.userId === partner.userId),
    };
  }, [selected, to, overview]);

  const scrollKey = conversation
    ? `${conversation.userId}:${conversation.messages.length}`
    : '';

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [scrollKey]);

  useEffect(() => {
    if (conversation && conversation.messages.length > 0)
      markConversationRead(
        conversation.userId,
        conversation.messages[conversation.messages.length - 1].createdAt,
      );
  }, [conversation]);

  function openPartner(partner: Partner) {
    setNotice('');
    setDraft('');
    setHasProfanity(false);
    setSearch('');
    setResults([]);
    setSelected(partner);
  }

  function send() {
    if (!conversation) return;
    const text = draft.trim();
    if (!text) return;
    if (containsProfanity(text)) {
      setHasProfanity(true);
      return;
    }
    connector.sendMessage(conversation.userId, text, (res) => {
      if (res.ok) {
        setDraft('');
        setNotice('');
        refreshMessages();
      } else {
        setNotice(formatError(res.error));
      }
    });
  }

  function setBlocked(block: boolean) {
    if (!conversation) return;
    const action = block ? connector.blockUser : connector.unblockUser;
    action(conversation.userId, () => refreshMessages());
    if (block) setSelected(null);
  }

  return (
    <Container fluid className="py-4 px-2 px-sm-4">
      <h1 className="text-center mb-4">Messages</h1>

      <Row className="g-4">
        <Col md={4} lg={3}>
          <h2 className="h5">New message</h2>
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
                    action
                    onClick={() =>
                      openPartner({
                        userId: r.id,
                        username: r.username,
                        elo: 0,
                      })
                    }
                  >
                    {r.username}
                  </ListGroup.Item>
                ))}
            </ListGroup>
          )}

          <h2 className="h5 mt-4">Conversations</h2>
          {conversations.length === 0 ? (
            <p className="text-muted">No conversations yet.</p>
          ) : (
            <ListGroup>
              {conversations.map((c) => {
                const last = c.messages[c.messages.length - 1];
                const unread = unreadCount(c);
                return (
                  <ListGroup.Item
                    key={c.userId}
                    action
                    active={conversation?.userId === c.userId}
                    onClick={() =>
                      openPartner({
                        userId: c.userId,
                        username: c.username,
                        elo: c.elo,
                      })
                    }
                  >
                    <div className="d-flex align-items-center gap-2">
                      <RankIcon elo={c.elo} />
                      <span className="flex-grow-1 text-truncate">
                        {c.username}
                      </span>
                      {unread > 0 && <Badge bg="danger">{unread}</Badge>}
                    </div>
                    {last && (
                      <div className="small text-muted text-truncate">
                        {last.fromMe ? 'You: ' : ''}
                        {last.text}
                      </div>
                    )}
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          )}

          {blocked.length > 0 && (
            <details className="mt-4" onToggle={() => playSound('click')}>
              <summary className="fw-bold py-2">
                Blocked players ({blocked.length})
              </summary>
              <ListGroup className="mt-2">
                {blocked.map((b) => (
                  <ListGroup.Item
                    key={b.userId}
                    className="d-flex align-items-center gap-2"
                  >
                    <RankIcon elo={b.elo} />
                    <span className="flex-grow-1 text-truncate">
                      {b.username}
                    </span>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() =>
                        connector.unblockUser(b.userId, () => refreshMessages())
                      }
                    >
                      Unblock
                    </Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </details>
          )}
        </Col>

        <Col md={8} lg={9}>
          {!conversation ? (
            <p className="text-muted">
              Pick a conversation or search for a player to start messaging.
            </p>
          ) : (
            <>
              <div className="d-flex align-items-center gap-2 mb-3">
                <RankIcon elo={conversation.elo} />
                <Button
                  variant="link"
                  className="p-0 text-decoration-none fs-5"
                  onClick={() =>
                    navigate(
                      `/players/${encodeURIComponent(conversation.username)}`,
                    )
                  }
                >
                  {conversation.username}
                </Button>
                <div className="flex-grow-1" />
                <Button
                  size="sm"
                  variant={
                    conversation.blocked
                      ? 'outline-secondary'
                      : 'outline-danger'
                  }
                  onClick={() => setBlocked(!conversation.blocked)}
                >
                  {conversation.blocked ? 'Unblock' : 'Block'}
                </Button>
              </div>

              <div
                className="d-flex flex-column gap-2 border rounded p-2 mb-3"
                style={{ height: '60vh', overflowY: 'auto' }}
              >
                {conversation.messages.length === 0 ? (
                  <p className="text-muted m-auto">No messages yet.</p>
                ) : (
                  conversation.messages.map((m, i) => (
                    <div
                      key={i}
                      className={`d-flex flex-column ${
                        m.fromMe
                          ? 'align-self-end align-items-end'
                          : 'align-self-start'
                      }`}
                      style={{ maxWidth: '75%' }}
                    >
                      <div
                        className={`rounded px-2 py-1 ${
                          m.fromMe
                            ? 'bg-primary text-white'
                            : 'bg-secondary-subtle border'
                        }`}
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {m.text}
                      </div>
                      <span className="small text-muted">
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              {notice && (
                <Alert
                  variant="danger"
                  className="py-1 px-2 small"
                  dismissible
                  onClose={() => setNotice('')}
                >
                  {notice}
                </Alert>
              )}

              {conversation.blocked ? (
                <p className="text-muted small">
                  You have blocked {conversation.username}. Unblock to send
                  messages.
                </p>
              ) : (
                <Form.Group>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    maxLength={MAX_LENGTH}
                    placeholder="Write a message"
                    value={draft}
                    isInvalid={hasProfanity}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setHasProfanity(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <Form.Control.Feedback type="invalid">
                    Message contains profanity
                  </Form.Control.Feedback>
                  <div className="d-flex align-items-center justify-content-between mt-2">
                    <span className="small text-muted">
                      {draft.length}/{MAX_LENGTH}
                    </span>
                    <Button size="sm" disabled={!draft.trim()} onClick={send}>
                      Send
                    </Button>
                  </div>
                </Form.Group>
              )}
            </>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default Messages;
