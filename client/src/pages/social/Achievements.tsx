import { useEffect, useState } from 'react';
import { connector } from '../../connector';
import type { PlayerAchievement } from '../../lib/types';

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
  const earned = achievements.filter((a) => a.achievedAt !== null).length;

  return (
    <div className="mb-4">
      <h4 className="mb-3">
        Achievements ({earned}/{achievements.length})
      </h4>
      <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xl-6 g-2">
        {achievements.map((achievement) => {
          const locked = achievement.achievedAt === null;
          return (
            <div key={achievement.id} className="col">
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
                <div className="small text-muted">
                  {achievement.description}
                </div>
                <div className="small mt-1">
                  {achievement.achievedAt === null
                    ? 'Locked'
                    : new Date(achievement.achievedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Achievements;
