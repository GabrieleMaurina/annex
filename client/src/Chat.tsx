import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Form, ListGroup } from 'react-bootstrap';
import { playerColor } from './palette';
import { socket } from './socket';
import type { ChatMessage } from './types';

interface Props {
  nameById: Map<number, string>;
  colorById: Map<number, number>;
  transparent?: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

function Chat({ nameById, colorById, transparent, open, setOpen }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    if (!open) summaryRef.current?.blur();
  }, [open]);

  useEffect(() => {
    function onMessage(message: ChatMessage) {
      setMessages((prev) => [...prev, message]);
      if (!openRef.current) setUnreadCount((prev) => prev + 1);
    }
    socket.on('game:chatMessage', onMessage);
    return () => {
      socket.off('game:chatMessage', onMessage);
    };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function toggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = e.currentTarget.open;
    setOpen(isOpen);
    if (isOpen) setUnreadCount(0);
  }

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    socket.emit('game:chat', { message: trimmed });
    setText('');
  }

  return (
    <div
      className={`position-fixed bottom-0 start-0 m-3 p-2 bg-body border rounded${
        transparent ? ' bg-opacity-75' : ''
      }`}
      style={{ zIndex: 1 }}
    >
      <details open={open} onToggle={toggle} style={{ width: 300 }}>
        <summary ref={summaryRef}>
          Chat
          {!open && unreadCount > 0 && (
            <Badge bg="danger" className="ms-2">
              {unreadCount}
            </Badge>
          )}
        </summary>
        <div
          ref={listRef}
          style={{ height: 200, overflowY: 'auto' }}
          className="my-2 border rounded"
        >
          <ListGroup variant="flush">
            {messages.map((m, i) => {
              const color = colorById.get(m.id);
              return (
                <ListGroup.Item key={i} className="py-1">
                  <strong
                    style={
                      color !== undefined
                        ? { color: playerColor(color) }
                        : undefined
                    }
                  >
                    {nameById.get(m.id) ?? m.name}:
                  </strong>{' '}
                  {m.message}
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </div>
        <Form.Group className="d-flex gap-2">
          <Form.Control
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <Button onClick={send}>Send</Button>
        </Form.Group>
      </details>
    </div>
  );
}

export default Chat;
