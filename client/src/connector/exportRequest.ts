import { httpGet } from '../lib/http';
import type { ExportCallback, ExportData } from '../lib/types';

export function requestExport(path: string, cb: ExportCallback): void {
  httpGet<ExportData>(path).then(
    (data) =>
      cb(
        'kind' in data ? data : null,
        typeof data.error === 'string' ? data.error : undefined,
      ),
    () => cb(null, 'server error'),
  );
}
