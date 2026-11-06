import { httpGet } from '../../lib/http';

type ProfileReply =
  { ok: true; picture: string | null; bio: string } | { ok: false };

export function fetchPlayerProfile(
  userId: string,
  cb: (picture: string | null, bio: string) => void,
): void {
  httpGet<ProfileReply>(
    '/players/id/' + encodeURIComponent(userId) + '/profile',
  )
    .then((res) => {
      if (res.ok) cb(res.picture, res.bio);
    })
    .catch(() => {});
}
