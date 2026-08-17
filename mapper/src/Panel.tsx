import type {
  ChangeEvent,
  CSSProperties,
  Dispatch,
  SetStateAction,
} from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { decodeBase85, encodeBase85 } from './base85';
import { createDefaultImage } from './defaultImage';
import { bytesToDataUrl, dataUrlToBytes, mimeFromDataUrl } from './imageBytes';
import { continentColor } from './palette';
import type { Map, Territory } from './types';

const MIN_CONTINENTS = 1;
const MAX_CONTINENTS = 20;
const MIN_BONUS = 1;
const MAX_BONUS = 10;

interface Props {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  continentCount: number;
  setContinentCount: Dispatch<SetStateAction<number>>;
  bonuses: number[];
  setBonuses: Dispatch<SetStateAction<number[]>>;
  imageSrc: string;
  setImageSrc: Dispatch<SetStateAction<string>>;
  mapName: string;
  setMapName: Dispatch<SetStateAction<string>>;
  setCurrentContinentId: Dispatch<SetStateAction<number>>;
}

function resizeBonuses(bonuses: number[], count: number): number[] {
  if (count > bonuses.length) {
    return [...bonuses, ...Array(count - bonuses.length).fill(2)];
  }
  return bonuses.slice(0, count);
}

function removeOutOfBounds(
  territories: Territory[],
  w: number,
  h: number,
): Territory[] {
  const keepIds = new Set(
    territories
      .filter((t) => t.x >= 0 && t.x <= w && t.y >= 0 && t.y <= h)
      .map((t) => t.id),
  );
  return territories
    .filter((t) => keepIds.has(t.id))
    .map((t) => ({
      ...t,
      neighbors: t.neighbors.filter((n) => keepIds.has(n)),
    }));
}

function isValidTerritory(t: unknown): t is Territory {
  if (typeof t !== 'object' || t === null) return false;
  const c = t as Territory;
  return (
    typeof c.id === 'number' &&
    typeof c.continentId === 'number' &&
    typeof c.x === 'number' &&
    typeof c.y === 'number' &&
    Array.isArray(c.neighbors) &&
    c.neighbors.every((n) => typeof n === 'number')
  );
}

function isValidMapFile(m: unknown): m is Map {
  if (typeof m !== 'object' || m === null) return false;
  const f = m as Map;
  return (
    typeof f.name === 'string' &&
    (f.image === null || typeof f.image === 'string') &&
    (f.imageMime === null || typeof f.imageMime === 'string') &&
    Array.isArray(f.bonuses) &&
    f.bonuses.every((b) => typeof b === 'number') &&
    Array.isArray(f.territories) &&
    f.territories.every(isValidTerritory)
  );
}

function Panel({
  collapsed,
  setCollapsed,
  territories,
  setTerritories,
  continentCount,
  setContinentCount,
  bonuses,
  setBonuses,
  imageSrc,
  setImageSrc,
  mapName,
  setMapName,
  setCurrentContinentId,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addContinent() {
    if (continentCount >= MAX_CONTINENTS) return;
    setBonuses((prev) => [...prev, 2]);
    setContinentCount((c) => c + 1);
  }

  function deleteContinent(index: number) {
    if (continentCount <= MIN_CONTINENTS) return;
    const target = index > 0 ? index - 1 : index + 1;
    setTerritories((prev) =>
      prev.map((t) => {
        const continentId = t.continentId === index ? target : t.continentId;
        return continentId > index
          ? { ...t, continentId: continentId - 1 }
          : { ...t, continentId };
      }),
    );
    setBonuses((prev) => prev.filter((_, i) => i !== index));
    setContinentCount((c) => c - 1);
  }

  function updateBonus(index: number, value: number) {
    if (Number.isNaN(value)) return;
    const clamped = Math.max(MIN_BONUS, Math.min(MAX_BONUS, Math.round(value)));
    setBonuses((prev) => prev.map((b, i) => (i === index ? clamped : b)));
  }

  const handleImportFile = useCallback(
    (file: File) => {
      const lowerName = file.name.toLowerCase();
      if (
        file.type === 'application/json' ||
        lowerName.endsWith('.json') ||
        lowerName.endsWith('.anx')
      ) {
        const reader = new FileReader();
        reader.onload = () => {
          let mapFile: unknown;
          try {
            mapFile = JSON.parse(reader.result as string);
          } catch {
            return;
          }
          if (!isValidMapFile(mapFile)) return;
          const dataUrl =
            mapFile.image === null
              ? createDefaultImage()
              : bytesToDataUrl(decodeBase85(mapFile.image), mapFile.imageMime!);
          const count = Math.max(MIN_CONTINENTS, mapFile.bonuses.length);
          setTerritories(mapFile.territories);
          setContinentCount(count);
          setBonuses(resizeBonuses(mapFile.bonuses, count));
          setImageSrc(dataUrl);
          setMapName(mapFile.name);
          setCurrentContinentId(0);
        };
        reader.readAsText(file);
        return;
      }

      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          setTerritories((prev) =>
            removeOutOfBounds(prev, img.naturalWidth, img.naturalHeight),
          );
          setImageSrc(dataUrl);
          setMapName(file.name.replace(/\.[^.]+$/, ''));
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [
      setTerritories,
      setContinentCount,
      setBonuses,
      setImageSrc,
      setMapName,
      setCurrentContinentId,
    ],
  );

  useEffect(() => {
    function onDrop(e: DragEvent) {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) handleImportFile(file);
    }
    function onDragOver(e: DragEvent) {
      e.preventDefault();
    }
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', onDragOver);
    return () => {
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragover', onDragOver);
    };
  }, [handleImportFile]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleImportFile(file);
  }

  function handleNew() {
    setTerritories([]);
    setImageSrc(createDefaultImage());
    setContinentCount(1);
    setBonuses([2]);
  }

  const handleExport = useCallback(() => {
    if (!mapName.trim()) return;
    const baseName = mapName.replace(/\.(anx|json)$/i, '');
    const isBlankImage = imageSrc === createDefaultImage();
    const mapFile: Map = {
      name: baseName,
      territories,
      bonuses,
      image: isBlankImage ? null : encodeBase85(dataUrlToBytes(imageSrc)),
      imageMime: isBlankImage ? null : mimeFromDataUrl(imageSrc),
    };
    const blob = new Blob([JSON.stringify(mapFile)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.anx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [mapName, imageSrc, territories, bonuses]);

  const isEmptyMap =
    territories.length === 0 && imageSrc === createDefaultImage();
  const canExport = !!mapName.trim() && !isEmptyMap;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      if (canExport) handleExport();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canExport, handleExport]);

  if (collapsed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="position-absolute top-0 end-0 m-2"
        onClick={() => setCollapsed(false)}
      >
        ☰
      </Button>
    );
  }

  return (
    <div
      className="position-absolute top-0 end-0 bg-body bg-opacity-75 border rounded p-3 m-2 d-flex flex-column"
      style={{ width: 280, maxHeight: 'calc(100vh - 1rem)' }}
    >
      <div className="d-flex justify-content-end mb-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCollapsed(true)}
        >
          &gt;
        </Button>
      </div>

      <Form.Control
        ref={fileInputRef}
        type="file"
        accept=".anx,.json,image/*"
        className="d-none"
        onChange={handleFileChange}
      />
      <Button
        variant="primary"
        className="w-100 mb-2"
        onClick={() => fileInputRef.current?.click()}
      >
        Import
      </Button>
      <Button
        variant="primary"
        className="w-100 mb-2"
        onClick={handleExport}
        disabled={!canExport}
      >
        Export
      </Button>
      <Button
        variant="primary"
        className="w-100 mb-3"
        onClick={handleNew}
        disabled={isEmptyMap}
      >
        New
      </Button>

      <Form.Group className="mb-3">
        <Form.Label className="fw-bold">Map Name</Form.Label>
        <Form.Control
          type="text"
          value={mapName}
          onChange={(e) => setMapName(e.target.value)}
          placeholder="Enter map name"
        />
      </Form.Group>

      <div
        className="flex-grow-1 overflow-auto no-scrollbar"
        style={{ minHeight: 0 }}
      >
        <div className="mb-2 fw-bold">
          Total territories: {territories.length}
        </div>
        <Table size="sm" borderless className="mb-3 text-center">
          <thead>
            <tr>
              <th>#</th>
              <th>Size</th>
              <th>Bonus</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: continentCount }, (_, i) => (
              <tr
                key={i}
                style={{ '--bs-table-bg': continentColor(i) } as CSSProperties}
              >
                <td>{i + 1}</td>
                <td>{territories.filter((t) => t.continentId === i).length}</td>
                <td>
                  <Form.Control
                    type="number"
                    size="sm"
                    className="text-center"
                    min={MIN_BONUS}
                    max={MAX_BONUS}
                    value={bonuses[i] ?? 2}
                    onChange={(e) => updateBonus(i, Number(e.target.value))}
                  />
                </td>
                <td>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deleteContinent(i)}
                    disabled={continentCount <= MIN_CONTINENTS}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="text-center">
                <Button
                  variant="success"
                  size="sm"
                  onClick={addContinent}
                  disabled={continentCount >= MAX_CONTINENTS}
                >
                  +
                </Button>
              </td>
            </tr>
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default Panel;
