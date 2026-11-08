import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Modal,
  ProgressBar,
  Spinner,
} from 'react-bootstrap';
import type { GameState } from '../../../lib/types';
import DualRange from '../../../ui/forms/DualRange';
import Selector from '../../../ui/forms/Selector';
import { END_CARD_MS, endCardFor } from '../../endCard/endCard';
import type { ReplayData } from '../replay';
import ClipPreview from './ClipPreview';
import { startClipExport } from './clipExport';
import {
  clipIndices,
  defaultDuration,
  durationOptions,
  frameDurations,
  MAX_CLIP_FRAMES,
  roundAt,
  SUGGESTED_DENSITY,
  suggestedDuration,
  suggestedFormat,
  type ClipDensity,
  type ClipFormat,
} from './clipFrames';
import { loadClipScene, type ClipScene } from './clipScene';
import { MP4_SUPPORTED } from './output/mp4Writer';

interface Props {
  show: boolean;
  onHide: () => void;
  game: GameState;
  mapName: string;
  replay: ReplayData;
}

interface Result {
  key: string;
  file: File;
}

const DENSITY_OPTIONS: [ClipDensity, string][] = [
  ['rounds', 'Every round'],
  ['turns', 'Every turn'],
  ['moves', 'Every move'],
];

const FORMAT_OPTIONS: [ClipFormat, string][] = [
  ['gif', 'GIF'],
  ['mp4', 'MP4'],
];

function suggestedLabel(label: string, suggested: boolean): string {
  return suggested ? `${label} (suggested)` : label;
}

function formatDuration(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;
}

interface Progress {
  done: number;
  total: number;
}

function isIndeterminate({ done, total }: Progress): boolean {
  return done === 0 || done >= total;
}

function progressText({ done, total }: Progress): string {
  if (done === 0) return 'Preparing…';
  if (done >= total) return 'Finishing…';
  return `Rendering frames ${done}/${total}`;
}

function fileName(gameName: string, format: ClipFormat): string {
  const slug = gameName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'annex'}-replay.${format}`;
}

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function ExportReplayModal({ show, onHide, game, mapName, replay }: Props) {
  const total = replay.frames.length;
  const [scene, setScene] = useState<ClipScene | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(total);
  const [density, setDensity] = useState<ClipDensity | null>(null);
  const [durationChoice, setDurationChoice] = useState<number | null>(null);
  const [showRound, setShowRound] = useState(true);
  const [sounds, setSounds] = useState(0.25);
  const [music, setMusic] = useState(0.75);
  const [scrub, setScrub] = useState<number | null>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [seek, setSeek] = useState<{ index: number } | null>(null);
  const [formatChoice, setFormatChoice] = useState<ClipFormat | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!show || scene) return;
    let current = true;
    loadClipScene(mapName, game.playerMapId).then(
      (loaded) => {
        if (current) setScene(loaded);
      },
      (e) => {
        if (current)
          setLoadError(
            e instanceof Error ? e.message : 'The map failed to load.',
          );
      },
    );
    return () => {
      current = false;
    };
  }, [show, scene, mapName, game.playerMapId]);

  useEffect(() => () => cancelRef.current?.(), []);

  useEffect(() => {
    if (!show) return;
    const keepFromMap = (e: WheelEvent) => e.stopPropagation();
    window.addEventListener('wheel', keepFromMap, true);
    return () => window.removeEventListener('wheel', keepFromMap, true);
  }, [show]);

  const defaultSeconds = useMemo(
    () => defaultDuration(replay, start, end),
    [replay, start, end],
  );
  const resolvedDensity = density ?? SUGGESTED_DENSITY;
  const indices = useMemo(
    () => clipIndices(replay, start, end, resolvedDensity),
    [replay, start, end, resolvedDensity],
  );
  const formatSuggestion = suggestedFormat(MP4_SUPPORTED);
  const format = formatChoice ?? formatSuggestion;
  const durationSuggestion =
    density === null ? defaultSeconds : suggestedDuration(indices.length);
  const duration = durationChoice ?? durationSuggestion;
  const durations = useMemo(
    () => frameDurations(indices.length, duration, format),
    [indices.length, duration, format],
  );
  const durationChoices = durationOptions(indices.length, format, [
    durationSuggestion,
    duration,
  ]);
  const endCard = useMemo(
    () => (end === total ? endCardFor(game) : null),
    [end, total, game],
  );
  const playIndices = useMemo(
    () => (endCard ? [...indices, end] : indices),
    [endCard, indices, end],
  );
  const playDurations = useMemo(
    () => (endCard ? [...durations, END_CARD_MS] : durations),
    [endCard, durations],
  );
  const outputSeconds = playDurations.reduce((sum, d) => sum + d, 0) / 1000;
  const withAudio = format === 'mp4';
  const optionsKey = `${start}:${end}:${resolvedDensity}:${duration}:${format}:${showRound}:${withAudio ? sounds : 0}:${withAudio ? music : 0}`;
  const tooMany = indices.length > MAX_CLIP_FRAMES;
  const working = progress !== null;
  const readyResult = result?.key === optionsKey ? result.file : null;
  const canShare =
    readyResult !== null &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [readyResult] });

  function stop() {
    cancelRef.current?.();
    cancelRef.current = null;
    setProgress(null);
  }

  function close() {
    stop();
    onHide();
  }

  function startExport() {
    if (!scene) return;
    const key = optionsKey;
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: indices.length });
    cancelRef.current = startClipExport(
      {
        scene,
        game,
        replay,
        indices: playIndices,
        durations: playDurations,
        endCard,
        showRound,
        animate: resolvedDensity === 'moves',
        sounds: withAudio ? sounds : 0,
        music: withAudio ? music : 0,
        format,
      },
      {
        onProgress: (done, count) => setProgress({ done, total: count }),
        onDone: (blob) => {
          cancelRef.current = null;
          setProgress(null);
          setResult({
            key,
            file: new File([blob], fileName(game.name, format), {
              type: blob.type,
            }),
          });
        },
        onError: (message) => {
          cancelRef.current = null;
          setProgress(null);
          setError(message);
        },
      },
    );
  }

  return (
    <Modal show={show} onHide={close} centered scrollable size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Export Replay</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="row g-3">
          <div className="col-lg-8 d-flex flex-column gap-3">
            {scene ? (
              <ClipPreview
                scene={scene}
                game={game}
                replay={replay}
                indices={playIndices}
                durations={playDurations}
                endCard={endCard}
                animate={resolvedDensity === 'moves'}
                showRound={showRound}
                scrubIndex={scrub}
                paused={working}
                seek={seek}
                onFrame={setPlayhead}
              />
            ) : loadError ? (
              <Alert variant="danger" className="mb-0">
                {loadError}
              </Alert>
            ) : (
              <div className="d-flex justify-content-center py-5">
                <Spinner animation="border" />
              </div>
            )}
            <Form.Group>
              <Form.Label className="small mb-0">
                Trim: Round {roundAt(replay, start)} to Round{' '}
                {roundAt(replay, end)}
              </Form.Label>
              <DualRange
                min={0}
                max={total}
                start={start}
                end={end}
                marker={working ? null : playhead}
                disabled={working}
                onScrub={setScrub}
                onSeek={(value) => setSeek({ index: value })}
                onChange={(nextStart, nextEnd) => {
                  setStart(nextStart);
                  setEnd(nextEnd);
                }}
              />
            </Form.Group>
          </div>
          <div className="col-lg-4 d-flex flex-column gap-3">
            <div className="d-flex flex-wrap flex-lg-column gap-3">
              <Form.Group className="flex-grow-1">
                <Form.Label className="small mb-0">Detail</Form.Label>
                <Selector
                  value={resolvedDensity}
                  disabled={working}
                  onChange={(value) => {
                    setDensity(value as ClipDensity);
                    setDurationChoice(null);
                  }}
                >
                  {DENSITY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {suggestedLabel(label, value === SUGGESTED_DENSITY)}
                    </option>
                  ))}
                </Selector>
              </Form.Group>
              <Form.Group className="flex-grow-1">
                <Form.Label className="small mb-0">Duration</Form.Label>
                <Selector
                  value={String(duration)}
                  disabled={working}
                  onChange={(value) => {
                    setDurationChoice(Number(value));
                  }}
                >
                  {durationChoices.map((seconds) => (
                    <option key={seconds} value={String(seconds)}>
                      {suggestedLabel(
                        formatDuration(seconds),
                        seconds === durationSuggestion,
                      )}
                    </option>
                  ))}
                </Selector>
              </Form.Group>
              <Form.Group className="flex-grow-1">
                <Form.Label className="small mb-0">Format</Form.Label>
                <Selector
                  value={format}
                  disabled={working}
                  onChange={(value) => setFormatChoice(value as ClipFormat)}
                >
                  {FORMAT_OPTIONS.map(([value, label]) => (
                    <option
                      key={value}
                      value={value}
                      disabled={value === 'mp4' && !MP4_SUPPORTED}
                    >
                      {suggestedLabel(label, value === formatSuggestion)}
                    </option>
                  ))}
                </Selector>
              </Form.Group>
            </div>
            <Form.Check
              type="switch"
              id="clip-show-round"
              label="Show round number"
              checked={showRound}
              disabled={working}
              onChange={(e) => setShowRound(e.target.checked)}
            />
            <Form.Group>
              <Form.Label className="small mb-0">
                Sounds: {withAudio ? Math.round(sounds * 100) : 0}%
              </Form.Label>
              <Form.Range
                min={0}
                max={100}
                value={Math.round(sounds * 100)}
                disabled={working || !withAudio}
                onChange={(e) => setSounds(Number(e.target.value) / 100)}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label className="small mb-0">
                Music: {withAudio ? Math.round(music * 100) : 0}%
              </Form.Label>
              <Form.Range
                min={0}
                max={100}
                value={Math.round(music * 100)}
                disabled={working || !withAudio}
                onChange={(e) => setMusic(Number(e.target.value) / 100)}
              />
            </Form.Group>
            <div
              className={`small ${tooMany ? 'text-danger' : 'text-secondary'}`}
            >
              {tooMany
                ? `${indices.length} frames is too many (max ${MAX_CLIP_FRAMES}). Trim the range or reduce the detail.`
                : `${indices.length} frames, ${outputSeconds.toFixed(1)} s`}
            </div>
            {progress && (
              <>
                <span className="small">{progressText(progress)}</span>
                <ProgressBar
                  now={
                    isIndeterminate(progress)
                      ? 100
                      : (progress.done / progress.total) * 100
                  }
                  animated={isIndeterminate(progress)}
                />
              </>
            )}
            {error && (
              <Alert variant="danger" className="py-1 px-2 small mb-0">
                {error}
              </Alert>
            )}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        {readyResult && (
          <span className="small text-secondary me-auto">
            {fileSize(readyResult.size)}
          </span>
        )}
        {working ? (
          <Button variant="secondary" onClick={stop}>
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
            <Button
              variant={readyResult ? 'secondary' : 'primary'}
              disabled={!scene || tooMany}
              onClick={startExport}
            >
              {readyResult ? 'Export again' : `Export ${format.toUpperCase()}`}
            </Button>
            {readyResult && (
              <Button variant="primary" onClick={() => download(readyResult)}>
                Download
              </Button>
            )}
            {readyResult && canShare && (
              <Button
                variant="primary"
                onClick={() =>
                  navigator
                    .share({ files: [readyResult], title: game.name })
                    .catch(() => {})
                }
              >
                Share
              </Button>
            )}
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}

export default ExportReplayModal;
