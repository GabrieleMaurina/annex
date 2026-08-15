import { useState } from 'react';
import { createDefaultImage } from './defaultImage';
import MapCanvas from './MapCanvas';
import Panel from './Panel';
import type { Territory } from './types';

function App() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [continentCount, setContinentCount] = useState(1);
  const [imageSrc, setImageSrc] = useState<string>(() => createDefaultImage());
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="position-relative vh-100 overflow-hidden">
      <MapCanvas
        territories={territories}
        setTerritories={setTerritories}
        continentCount={continentCount}
        imageSrc={imageSrc}
      />
      <Panel
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        territories={territories}
        setTerritories={setTerritories}
        continentCount={continentCount}
        setContinentCount={setContinentCount}
        imageSrc={imageSrc}
        setImageSrc={setImageSrc}
      />
    </div>
  );
}

export default App;
