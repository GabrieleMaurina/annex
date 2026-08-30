import { useState } from 'react';
import type { Territory } from '../types';
import { createDefaultImage } from '../utils/defaultImage';
import MapCanvas from './MapCanvas';
import Panel from './Panel';

function App() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [continentCount, setContinentCount] = useState(1);
  const [bonuses, setBonuses] = useState<number[]>([2]);
  const [imageSrc, setImageSrc] = useState<string>(() => createDefaultImage());
  const [collapsed, setCollapsed] = useState(false);
  const [mapName, setMapName] = useState('Map');
  const [currentContinentId, setCurrentContinentId] = useState(0);

  return (
    <div className="position-fixed top-0 bottom-0 start-0 end-0 overflow-hidden">
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
