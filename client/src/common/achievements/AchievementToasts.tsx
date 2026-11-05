import { useEffect, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { playSound } from '../../lib/sounds';
import type { PlayerAchievement } from '../../lib/types';
import { watchNewAchievements } from './newAchievements';

function AchievementToasts({ enabled }: { enabled: boolean }) {
  const [toasts, setToasts] = useState<PlayerAchievement[]>([]);

  useEffect(() => {
    if (!enabled) return;
    return watchNewAchievements((earned) => {
      playSound('bell');
      setToasts((prev) => [...prev, ...earned]);
    });
  }, [enabled]);

  return (
    <ToastContainer position="bottom-end" className="position-fixed p-3">
      {toasts.map((achievement) => (
        <Toast
          key={achievement.id}
          autohide
          delay={8000}
          onClose={() =>
            setToasts((prev) => prev.filter((t) => t.id !== achievement.id))
          }
        >
          <Toast.Header>
            <strong className="me-auto">Achievement unlocked!</strong>
          </Toast.Header>
          <Toast.Body className="d-flex align-items-center gap-3">
            <img
              src={`/achievements/${achievement.id}.svg`}
              alt=""
              width={56}
              height={56}
            />
            <div>
              <div className="fw-bold">{achievement.title}</div>
              <div className="small text-muted">{achievement.description}</div>
            </div>
          </Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  );
}

export default AchievementToasts;
