import { useLocation, useNavigate } from 'react-router-dom';
import { useToggleSound } from '../../../lib/sounds';

const EARTH_SEGMENT = '/earth';

export function useEarthRoute(id: string | undefined) {
  const navigate = useNavigate();
  const location = useLocation();
  const editorPath = id ? `/maps/editor/${id}` : '/maps/editor';
  const open = location.pathname.replace(/\/$/, '').endsWith(EARTH_SEGMENT);
  const fromEditor =
    (location.state as { fromEditor?: boolean } | null)?.fromEditor === true;
  useToggleSound(open);
  return {
    open,
    show: () =>
      navigate(editorPath + EARTH_SEGMENT, { state: { fromEditor: true } }),
    hide: () => {
      if (fromEditor) navigate(-1);
      else navigate(editorPath, { replace: true });
    },
  };
}
