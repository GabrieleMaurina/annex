import type { Dispatch, SetStateAction } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

export interface GameToast {
  id: number;
  message: string;
}

export default function GameToasts({
  paused,
  gameEnded,
  toasts,
  setToasts,
}: {
  paused: boolean;
  gameEnded: boolean;
  toasts: GameToast[];
  setToasts: Dispatch<SetStateAction<GameToast[]>>;
}) {
  return (
    <ToastContainer
      position="top-center"
      className="position-fixed p-3"
      style={{ zIndex: 3 }}
    >
      <Toast
        show={paused && !gameEnded}
        className="mx-auto"
        style={{ width: 'fit-content', maxWidth: 'none' }}
      >
        <Toast.Body className="text-nowrap fw-bold">Game Paused</Toast.Body>
      </Toast>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          autohide
          delay={5000}
          className="mx-auto"
          style={{ width: 'fit-content', maxWidth: 'none' }}
        >
          <Toast.Body className="text-nowrap">{t.message}</Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  );
}
