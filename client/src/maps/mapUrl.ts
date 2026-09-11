import { apiUrl } from '../lib/http';

export function mapImageUrl(id: string): string {
  return apiUrl('/player-maps/' + encodeURIComponent(id) + '/image');
}
