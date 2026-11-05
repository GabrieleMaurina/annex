import { useEffect, useState } from 'react';
import { connector } from '../../connector';
import { playSound } from '../../lib/sounds';
import type { PlayerAchievement } from '../../lib/types';

const GRID_CLASS =
  'row row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xl-6 g-2';

function AchievementCard({ achievement }: { achievement: PlayerAchievement }) {
  const locked = achievement.achievedAt === null;
  return (
    <div className="col">
      <div
        className={`border rounded p-2 text-center h-100 ${locked ? 'opacity-50' : ''}`}
      >
        <img
          src={`/achievements/${achievement.id}.svg`}
          alt=""
          width={72}
          height={72}
          className={locked ? 'grayscale' : undefined}
        />
        <div className="fw-bold mt-1">{achievement.title}</div>
        <div className="small text-muted">{achievement.description}</div>
        <div className="small mt-1">
          {achievement.achievedAt === null
            ? 'Locked'
            : new Date(achievement.achievedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function Achievements({ username }: { username: string }) {
  const [achievements, setAchievements] = useState<PlayerAchievement[]>([]);

  useEffect(() => {
    let stale = false;
    connector.getPlayerAchievements(username, (list) => {
      if (!stale) setAchievements(list);
    });
    return () => {
      stale = true;
    };
  }, [username]);

  if (achievements.length === 0) return null;
  const earned = achievements.filter((a) => a.achievedAt !== null);
  const locked = achievements.filter((a) => a.achievedAt === null);

  return (
    <div className="mb-4">
      <h4 className="mb-3">
        Achievements ({earned.length}/{achievements.length})
      </h4>
      {earned.length > 0 && (
        <div className={`${GRID_CLASS} mb-3`}>
          {earned.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      )}
      {locked.length > 0 && (
        <details onToggle={() => playSound('click')}>
          <summary className="collapsible-summary">
            Locked ({locked.length})
          </summary>
          <div className={GRID_CLASS}>
            {locked.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default Achievements;
