import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { useRef } from 'react';
import { decodeBase85, encodeBase85 } from './base85';
import {
  bytesToDataUrl,
  dataUrlToBytes,
  normalizeImageToPng,
} from './imageBytes';
import { continentColor } from './palette';
import type { MapFile, Territory } from './types';

interface Props {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  continentCount: number;
  setContinentCount: Dispatch<SetStateAction<number>>;
  imageSrc: string;
  setImageSrc: Dispatch<SetStateAction<string>>;
}

function Panel({
  collapsed,
  setCollapsed,
  territories,
  setTerritories,
  continentCount,
  setContinentCount,
  imageSrc,
  setImageSrc,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (
      file.type === 'application/json' ||
      file.name.toLowerCase().endsWith('.json')
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        const mapFile: MapFile = JSON.parse(reader.result as string);
        const dataUrl = bytesToDataUrl(
          decodeBase85(mapFile.image),
          'image/png',
        );
        const maxContinentId = mapFile.territories.reduce(
          (m, t) => Math.max(m, t.continentId),
          -1,
        );
        setTerritories(mapFile.territories);
        setContinentCount(Math.max(1, maxContinentId + 1));
        setImageSrc(dataUrl);
      };
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      normalizeImageToPng(reader.result as string, (pngDataUrl) => {
        setTerritories([]);
        setContinentCount(1);
        setImageSrc(pngDataUrl);
      });
    };
    reader.readAsDataURL(file);
  }

  function handleExport() {
    const mapFile: MapFile = {
      territories,
      image: encodeBase85(dataUrlToBytes(imageSrc)),
    };
    const blob = new Blob([JSON.stringify(mapFile)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (collapsed) {
    return (
      <button
        className="btn btn-secondary position-absolute top-0 end-0 m-2"
        onClick={() => setCollapsed(false)}
      >
        ☰
      </button>
    );
  }

  return (
    <div
      className="position-absolute top-0 end-0 h-100 bg-light border-start p-3"
      style={{ width: 280 }}
    >
      <div className="d-flex justify-content-end mb-3">
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setCollapsed(true)}
        >
          ✕
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,image/*"
        className="d-none"
        onChange={handleFileChange}
      />
      <button
        className="btn btn-primary w-100 mb-2"
        onClick={() => fileInputRef.current?.click()}
      >
        Import
      </button>
      <button className="btn btn-primary w-100 mb-3" onClick={handleExport}>
        Export
      </button>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Continents: {continentCount}</span>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setContinentCount((c) => c + 1)}
        >
          +
        </button>
      </div>
      <div className="d-flex flex-wrap gap-1">
        {Array.from({ length: continentCount }, (_, i) => (
          <div
            key={i}
            className="rounded-circle border border-dark"
            style={{
              width: 20,
              height: 20,
              backgroundColor: continentColor(i),
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default Panel;
