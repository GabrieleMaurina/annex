import { useEffect, useState } from 'react';
import { useWhiteIcon } from '../common/icon';
import Tip from '../common/tooltips/Tip';
import { connector } from '../connector';

function MapLikeButton({ mapId }: { mapId: string }) {
  const [likedState, setLikedState] = useState<{
    mapId: string;
    liked: boolean | null;
  } | null>(null);
  const liked = likedState?.mapId === mapId ? likedState.liked : null;
  const whiteHeartFull = useWhiteIcon('/icons/heart_full.svg');
  const whiteHeartEmpty = useWhiteIcon('/icons/heart_empty.svg');

  useEffect(() => {
    let stale = false;
    connector.getMapLiked(mapId, (value) => {
      if (!stale) setLikedState({ mapId, liked: value });
    });
    return () => {
      stale = true;
    };
  }, [mapId]);

  if (liked === null) return null;

  function toggle() {
    const next = !liked;
    setLikedState({ mapId, liked: next });
    connector.likeMap(mapId, next, (res) => {
      if (!res.ok) setLikedState({ mapId, liked: !next });
    });
  }

  return (
    <Tip text={liked ? 'Unlike this map' : 'Like this map to find it later'}>
      <button
        type="button"
        className="btn btn-sm p-0 d-inline-flex align-items-center"
        onClick={toggle}
      >
        <img
          src={
            liked
              ? (whiteHeartFull ?? '/icons/heart_full.svg')
              : (whiteHeartEmpty ?? '/icons/heart_empty.svg')
          }
          width={18}
          height={18}
          alt={liked ? 'Liked' : 'Like'}
        />
      </button>
    </Tip>
  );
}

export default MapLikeButton;
