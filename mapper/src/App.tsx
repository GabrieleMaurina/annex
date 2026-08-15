import { useState } from 'react';
import { createDefaultImage } from './defaultImage';
import MapCanvas from './MapCanvas';
import Panel from './Panel';
import type { Territory } from './types';

function App() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [continentCount, setContinentCount] = useState(1);
  const [bonuses, setBonuses] = useState<number[]>([2]);
  const [imageSrc, setImageSrc] = useState<string>(() => createDefaultImage());
  const [collapsed, setCollapsed] = useState(false);
  const [mapName, setMapName] = useState('map');
  const [currentContinentId, setCurrentContinentId] = useState(0);

  return (
    <div className="position-relative vh-100 overflow-hidden">
      <MapCanvas
        territories={territories}
        setTerritories={setTerritories}
        continentCount={continentCount}
        imageSrc={imageSrc}
        currentContinentId={currentContinentId}
        setCurrentContinentId={setCurrentContinentId}
        setCollapsed={setCollapsed}
      />
      <Panel
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        territories={territories}
        setTerritories={setTerritories}
        continentCount={continentCount}
        setContinentCount={setContinentCount}
        bonuses={bonuses}
        setBonuses={setBonuses}
        imageSrc={imageSrc}
        setImageSrc={setImageSrc}
        mapName={mapName}
        setMapName={setMapName}
        setCurrentContinentId={setCurrentContinentId}
      />
    </div>
  );
}

export default App;
