import { useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Text, Group, Rect } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import unitsData from './units_data.json';
import japaneseUnitsData from './japanese_units_data.json';
import mapData from './map_data.json';

// High-DPI setting
Konva.pixelRatio = window.devicePixelRatio || 1;

const UNIT_SIZE = 100;

const UnitCounter = ({ unit, x, y, onDragEnd, onToggleStatus }) => {
    // Load both images to prevent flickering when flipping
    const [frontImg] = useImage(`/images/${unit.frontImage}`);
    const [backImg] = useImage(unit.backImage ? `/images/${unit.backImage}` : null);

    // Determine current image based on status
    // For US: fresh=front, spent=back(or dim front)
    // For JP: fresh(hidden)=front(chit), spent(revealed)=back(unit) - abusing 'spent' for 'revealed' temporarily for demo
    const isSpent = unit.status === 'spent';

    // Use back image if spent and available, otherwise fallback to front
    const currentImage = (isSpent && backImg) ? backImg : frontImg;

    return (
        <Group
            x={x}
            y={y}
            draggable={!isSpent} // Note: JP units might need to be dragable even if revealed? For now standard rule.
            onDragEnd={(e) => {
                onDragEnd(unit.id, e.target.x(), e.target.y());
            }}
            onDblClick={(e) => {
                e.cancelBubble = true; // Prevent stage events
                onToggleStatus(unit.id);
            }}
        >
            {/* Shadow/Border for visibility */}
            <Rect
                width={UNIT_SIZE}
                height={UNIT_SIZE}
                fill="black"
                opacity={0.3}
                offsetX={-3}
                offsetY={-3}
            />
            {/* Visual cue for spent/selected state */}
            <Rect
                width={UNIT_SIZE}
                height={UNIT_SIZE}
                fill="#dcb"
                stroke={isSpent ? "red" : "black"}
                strokeWidth={isSpent ? 2 : 1}
            />

            {currentImage ? (
                <KonvaImage
                    image={currentImage}
                    width={UNIT_SIZE}
                    height={UNIT_SIZE}
                    opacity={1}
                />
            ) : (
                <Text text={unit.name} fontSize={14} width={UNIT_SIZE} padding={5} />
            )}
        </Group>
    );
};

const MapImage = ({ onImageLoad }) => {
    // ... existing MapImage code ...
    const [image, status] = useImage('/map.jpg');

    useEffect(() => {
        if (image) {
            console.log("Image loaded effect");
            // The map data coordinates go up to ~4935x3825
            // We should scale the image to match this 'world' size so polygons align.
            onImageLoad({ width: 4935, height: 3825 });
        }
    }, [image]); // Remove onImageLoad from dependencies to break loop

    if (status === 'loading') {
        return <Text text="Loading Map Image..." fill="white" fontSize={40} x={100} y={100} />;
    }
    if (status === 'failed') {
        return <Text text="Failed to load /map.jpg" fill="red" fontSize={40} x={100} y={100} />;
    }

    // Force the image to stretch to the specific world coordinates
    return <KonvaImage image={image} width={4935} height={3825} />;
};

function App() {
    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(0.25); // Zoom out a bit more initially
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const [units, setUnits] = useState([]);

    // Restore missing state
    const [selectedArea, setSelectedArea] = useState(null);
    const [hoveredArea, setHoveredArea] = useState(null);
    const [backendStatus, setBackendStatus] = useState('Checking...');

    useEffect(() => {
        // Initialize units with default positions (e.g., stacked in Area 4 for testing)
        // Area 4 is roughly at 2800, 500 based on map_data.json
        const initialUSUnits = unitsData.map((u, index) => ({
            ...u,
            x: 2800 + (index % 5) * 110, // Wider grid for larger units
            y: 500 + Math.floor(index / 5) * 110,
            status: 'fresh' // Default status
        }));
        // Japanese units are hidden by default until Start Game is clicked.
        setUnits(initialUSUnits);
    }, []);

    // Restore effects and handlers
    useEffect(() => {
        const handleResize = () => {
            setStageSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);

        // Backend check
        fetch('/api/health')
            .then(res => res.json())
            .then(data => setBackendStatus(data.status))
            .catch(() => setBackendStatus('Offline'));

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleImageLoad = (size) => {
        setMapSize(size);
        console.log("Auto-fitting map to screen. Image size:", size);

        // Calculate scale to fit the image within the window
        if (size.width > 0 && size.height > 0) {
            const scaleX = window.innerWidth / size.width;
            const scaleY = window.innerHeight / size.height;
            const newScale = Math.min(scaleX, scaleY) * 0.9; // 90% fit

            setScale(newScale);

            // Center it
            const newX = (window.innerWidth - size.width * newScale) / 2;
            const newY = (window.innerHeight - size.height * newScale) / 2;
            setPosition({ x: newX, y: newY });
        }
    };

    const handleWheel = (e) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const oldScale = scale;
        const pointer = e.target.getStage().getPointerPosition();

        const mousePointTo = {
            x: (pointer.x - position.x) / oldScale,
            y: (pointer.y - position.y) / oldScale,
        };

        const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
        setScale(newScale);

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        setPosition(newPos);
    };

    const handleUnitDragEnd = (id, newX, newY) => {
        // Update position AND set status to spent on movement completion
        setUnits(units.map(u => u.id === id ? { ...u, x: newX, y: newY, status: 'spent' } : u));
        console.log(`Moved unit ${id} to ${newX}, ${newY}`);
    };

    const handleUnitToggleStatus = (id) => {
        setUnits(units.map(u => {
            if (u.id === id) {
                return { ...u, status: u.status === 'fresh' ? 'spent' : 'fresh' };
            }
            return u;
        }));
    };

    const handleEndPhase = () => {
        setUnits(units.map(u => ({ ...u, status: 'fresh' })));
        console.log("End Phase: All units recovered to Fresh status.");
    };

    // Helper to calculate centroid of a polygon
    const getCentroid = (points) => {
        let x = 0, y = 0, n = points.length / 2;
        for (let i = 0; i < points.length; i += 2) {
            x += points[i];
            y += points[i + 1];
        }
        return { x: x / n, y: y / n };
    };

    const handleStartGame = () => {
        // 1. Separate JP units by terrain
        const pools = {
            Clear: japaneseUnitsData.filter(u => u.terrainType === 'Clear'),
            Urban: japaneseUnitsData.filter(u => u.terrainType === 'Urban'),
            Fort: japaneseUnitsData.filter(u => u.terrainType === 'Fort')
        };

        // Shuffle pools
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        Object.keys(pools).forEach(key => shuffle(pools[key]));

        // 2. Map areas to placement
        // We need to know which areas accept which terrain units.
        // Assuming map_data.json 'terrain' field matches 'Clear', 'Urban', 'Fort'.
        // And we place 1 unit per area if available.

        const newUnits = [];

        // Setup US Units (Based on updated units_data.json)
        const usUnits = [];
        const areaCounters = { "Area 1": 0, "Area 2": 0, "Area 30": 0 };

        unitsData.forEach((u) => {
            if (u.startArea === "Reinforcements" || !u.startArea) {
                // Not on map initially
                // We could place them in a box off-screen or just hide them.
                // Let's place them in a visible "Reinforcement Box" area (e.g. bottom right)
                usUnits.push({
                    ...u,
                    x: 4000 + (usUnits.length % 5) * 110, // Far off map
                    y: 3000 + Math.floor(usUnits.length / 5) * 110,
                    status: 'fresh'
                });
            } else {
                // Place in specific area
                const areaName = u.startArea;
                const area = mapData.find(a => a.name === areaName);

                if (area) {
                    const center = getCentroid(area.points);
                    // Offset based on count to stack/grid them
                    let offsetX = 0;
                    let offsetY = 0;

                    const count = areaCounters[areaName] || 0;

                    if (areaName === "Area 2") {
                        // Split into 3 columns/groups for Area 2
                        const group = count % 3;
                        const subIndex = Math.floor(count / 3);

                        // Base offset for groups (Left, Center, Right)
                        const groupBaseX = (group - 1) * 120; // -120, 0, +120

                        // Tiled layout within group (tighter packing)
                        // Shift entire Area 2 group drastically Left (-300) and Up (-50)
                        offsetX = (subIndex % 4) * 8 - 15 + groupBaseX - 300;
                        offsetY = Math.floor(subIndex / 4) * 8 - 15 - 50;
                    } else if (areaName === "Area 30") {
                        // Area 30: Shift Left by 120
                        offsetX = (count % 5) * 5 - 10 - 120;
                        offsetY = Math.floor(count / 5) * 5 - 10;
                    } else {
                        // Standard layout (Area 1 etc)
                        offsetX = (count % 5) * 5 - 10;
                        offsetY = Math.floor(count / 5) * 5 - 10;
                    }

                    usUnits.push({
                        ...u,
                        x: center.x + offsetX,
                        y: center.y + offsetY,
                        status: 'fresh'
                    });

                    areaCounters[areaName] = count + 1;
                } else {
                    // Fallback
                    usUnits.push({
                        ...u,
                        x: 2800,
                        y: 500,
                        status: 'fresh'
                    });
                }
            }
        });

        newUnits.push(...usUnits);

        // Setup JP Units
        // Iterate through all map areas
        const usStartAreas = ["Area 1", "Area 2", "Area 30", "Reinforcements"];

        mapData.forEach(area => {
            // Check if this area needs a unit
            // Rule check: All areas? Or specific ones?
            // User said: "map on corresponding terrain icon having areas"
            // For now, if the area has a terrain type matching our pools, we try to place one.

            // EXCLUDE US START AREAS to prevent immediate melee
            if (usStartAreas.includes(area.name)) {
                return;
            }

            const terrain = area.terrain; // "Clear", "Urban", "Fort", etc.

            if (pools[terrain] && pools[terrain].length > 0) {
                const unit = pools[terrain].pop();
                const center = getCentroid(area.points);

                // Add unit with position
                newUnits.push({
                    ...unit,
                    x: center.x - UNIT_SIZE / 2, // Centering adjustments
                    y: center.y - UNIT_SIZE / 2,
                    status: 'fresh' // fresh = hidden/chit side
                });
            }
        });

        setUnits(newUnits);
        console.log("Game Started: Units distributed.");
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#222' }}>
            {/* UI Overlay */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: 20,
                zIndex: 10,
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '1rem',
                borderRadius: '8px',
                maxWidth: '300px',
            }}>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#ffcc00' }}>Manila 1945</h2>
                <div style={{ fontSize: '0.9rem', marginBottom: '5px' }}>Backend: <span style={{ color: backendStatus === 'healthy' ? '#0f0' : '#f00' }}>{backendStatus}</span></div>
                <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
                    Map WxH: {mapSize.width} x {mapSize.height}<br />
                    Scale: {scale.toFixed(4)}<br />
                    Pos: {position.x.toFixed(0)}, {position.y.toFixed(0)}
                </div>
                {/* Fallback raw image check */}
                <div style={{ marginTop: '5px', border: '1px solid white', width: '50px', height: '50px', overflow: 'hidden' }}>
                    <img src="/map.jpg" alt="Check" style={{ width: '100%' }} />
                </div>
                <div style={{ marginTop: '10px', borderTop: '1px solid #555', paddingTop: '10px' }}>
                    <strong>Selected Area:</strong>
                    {selectedArea ? (
                        <div>
                            <div style={{ fontSize: '1.5rem', color: '#00ccff' }}>{selectedArea.name}</div>
                            <div style={{ color: '#aaa' }}>Terrain: {selectedArea.terrain}</div>
                        </div>
                    ) : (
                        <div style={{ color: '#777' }}>Click an area...</div>
                    )}
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#888' }}>
                    Wheel to zoom, Drag to pan<br />
                    Double-click unit to flip
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #555', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    <button
                        onClick={handleStartGame}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: '#d32f2f', // Red for Start
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold'
                        }}
                    >
                        Start Game
                    </button>
                    <button
                        onClick={handleEndPhase}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: '#0066cc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold'
                        }}
                    >
                        End Phase
                    </button>
                </div>
            </div>

            <Stage
                width={stageSize.width}
                height={stageSize.height}
                draggable
                onWheel={handleWheel}
                scaleX={scale}
                scaleY={scale}
                x={position.x}
                y={position.y}
                onDragEnd={(e) => {
                    // Only update stage position if the stage itself was dragged
                    if (e.target === e.target.getStage()) {
                        setPosition({ x: e.target.x(), y: e.target.y() });
                    }
                }}
            >
                <Layer imageSmoothingEnabled={false}>
                    <Rect x={-5000} y={-5000} width={10000} height={10000} fill="#333" />
                    <MapImage onImageLoad={handleImageLoad} />
                    {mapData.map((area, i) => (
                        <Line
                            key={i}
                            points={area.points}
                            fill={selectedArea?.name === area.name ? 'rgba(255, 0, 0, 0.4)' : (hoveredArea === area.name ? 'rgba(255, 255, 255, 0.2)' : 'transparent')}
                            stroke={selectedArea?.name === area.name ? 'red' : 'rgba(255,255,0,0.3)'}
                            strokeWidth={3}
                            closed
                            onMouseEnter={() => {
                                document.body.style.cursor = 'pointer';
                                setHoveredArea(area.name);
                            }}
                            onMouseLeave={() => {
                                document.body.style.cursor = 'default';
                                setHoveredArea(null);
                            }}
                            onClick={() => setSelectedArea(area)}
                            onTap={() => setSelectedArea(area)}
                        />
                    ))}

                    {/* Units */}
                    {units.map((unit) => (
                        <UnitCounter
                            key={unit.id}
                            unit={unit}
                            x={unit.x}
                            y={unit.y}
                            onDragEnd={handleUnitDragEnd}
                            onToggleStatus={handleUnitToggleStatus}
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
}

export default App;
