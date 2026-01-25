import { useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Text, Group, Rect } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import unitsData from './units_data.json';
import mapData from './map_data.json';

// High-DPI setting
Konva.pixelRatio = window.devicePixelRatio || 1;

const UNIT_SIZE = 100;

const UnitCounter = ({ unit, x, y, onDragEnd, onToggleStatus }) => {
    // Load both images to prevent flickering when flipping
    const [frontImg] = useImage(`/images/${unit.frontImage}`);
    const [backImg] = useImage(unit.backImage ? `/images/${unit.backImage}` : null);

    // Determine current image based on status
    const isSpent = unit.status === 'spent';

    // Use back image if spent and available, otherwise fallback to front
    const currentImage = (isSpent && backImg) ? backImg : frontImg;

    return (
        <Group
            x={x}
            y={y}
            draggable={!isSpent} // Disable drag if spent
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
            {/* Visual cue for spent state if using front image fallback, or just simpler border */}
            <Rect
                width={UNIT_SIZE}
                height={UNIT_SIZE}
                fill="#dcb"
                stroke={isSpent ? "gray" : "black"}
                strokeWidth={isSpent ? 4 : 2}
            />

            {currentImage ? (
                <KonvaImage
                    image={currentImage}
                    width={UNIT_SIZE}
                    height={UNIT_SIZE}
                    opacity={isSpent && !backImg ? 0.6 : 1} // Dim if no back image
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
        const initialUnits = unitsData.map((u, index) => ({
            ...u,
            x: 2800 + (index % 5) * 110, // Wider grid for larger units
            y: 500 + Math.floor(index / 5) * 110,
            status: 'fresh' // Default status
        }));
        setUnits(initialUnits);
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
                <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #555' }}>
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
