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

const UnitCounter = ({ unit, x, y, indexInStack, onDragStart, onDragEnd, onClick, onDblClick, onHover }) => {
    // Load both images to prevent flickering when flipping
    const [frontImg] = useImage(`/images/${unit.frontImage}`);
    const [backImg] = useImage(unit.backImage ? `/images/${unit.backImage}` : null);

    // Determine current image based on status
    const isSpent = unit.status === 'spent';

    // Use back image if spent and available, otherwise fallback to front
    const currentImage = (isSpent && backImg) ? backImg : frontImg;

    // Stack offset logic
    const offset = (indexInStack || 0) * 5;

    return (
        <Group
            x={x + offset}
            y={y + offset}
            draggable={!isSpent}
            onDragStart={(e) => {
                onDragStart && onDragStart(unit.id);
            }}
            onDragEnd={(e) => {
                onDragEnd(unit.id, e.target.x() - offset, e.target.y() - offset);
            }}
            onClick={(e) => {
                e.cancelBubble = true;
                onClick && onClick(unit.id);
            }}
            onDblClick={(e) => {
                e.cancelBubble = true;
                onDblClick && onDblClick(unit.id);
            }}
            onMouseEnter={(e) => {
                const stage = e.target.getStage();
                const pointer = stage.getPointerPosition();
                onHover && onHover(unit, true, pointer);
            }}
            onMouseLeave={() => {
                onHover && onHover(unit, false);
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
    const [stageSize, setStageSize] = useState({ width: Math.floor(window.innerWidth * 0.6), height: window.innerHeight });
    const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(0.25); // Zoom out a bit more initially
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const [units, setUnits] = useState([]);

    // Restore missing state
    const [selectedArea, setSelectedArea] = useState(null);
    const [hoveredArea, setHoveredArea] = useState(null);
    const [hoveredStack, setHoveredStack] = useState(null); // { units: [], pointer: {x, y} }
    const [backendStatus, setBackendStatus] = useState('Checking...');
    const [usControl, setUsControl] = useState(3); // Start with 3 areas

    // Resource State
    const [supplyPoints, setSupplyPoints] = useState(12); // Initial Supply
    const [supportUnits, setSupportUnits] = useState({
        artillery: { name: 'Artillery', type: 'artillery', available: 0, used: 0, max: 11, cost: 1 },
        engineer: { name: 'Engineer', type: 'engineer', available: 0, used: 0, max: 3, cost: 2 },
        air: { name: 'Air Support', type: 'air', available: 0, used: 0, max: 2, cost: 0 } // Cost rule varies
    });

    // Resource Handlers
    const handleAdjustSupply = (amount) => {
        setSupplyPoints(prev => Math.max(0, prev + amount));
    };

    const handleBuySupport = (type) => {
        const unit = supportUnits[type];
        if (!unit) return;
        // Check supply and max limit (Total = available + used)
        // Wait, "Max" refers to physical counters. So (available + used) < max
        if (supplyPoints >= unit.cost && (unit.available + unit.used) < unit.max) {
            setSupplyPoints(prev => prev - unit.cost);
            setSupportUnits(prev => ({
                ...prev,
                [type]: { ...prev[type], available: prev[type].available + 1 }
            }));
        }
    };

    const handleUseSupport = (type) => {
        const unit = supportUnits[type];
        if (unit.available > 0) {
            setSupportUnits(prev => ({
                ...prev,
                [type]: {
                    ...prev[type],
                    available: prev[type].available - 1,
                    used: prev[type].used + 1
                }
            }));
        }
    };

    const handleReturnSupport = (type) => { // Undo Use
        const unit = supportUnits[type];
        if (unit.used > 0) {
            setSupportUnits(prev => ({
                ...prev,
                [type]: {
                    ...prev[type],
                    available: prev[type].available + 1,
                    used: prev[type].used - 1
                }
            }));
        }
    };

    useEffect(() => {
        // Start with empty board (user must click Start Game)
        setUnits([]);
    }, []);

    // Restore effects and handlers
    useEffect(() => {
        const handleResize = () => {
            setStageSize({ width: Math.floor(window.innerWidth * 0.6), height: window.innerHeight });
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
            const stageW = Math.floor(window.innerWidth * 0.6);
            const scaleX = stageW / size.width;
            const scaleY = window.innerHeight / size.height;
            const newScale = Math.min(scaleX, scaleY) * 0.9; // 90% fit

            setScale(newScale);

            // Center it
            const newX = (stageW - size.width * newScale) / 2;
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

    const handleUnitDblClick = (id) => {
        setUnits(units.map(u => {
            if (u.id === id) {
                return { ...u, status: u.status === 'fresh' ? 'spent' : 'fresh' };
            }
            return u;
        }));
    };

    const handleUnitClick = (id) => {
        // Rotate stack logic
        const clickedUnit = units.find(u => u.id === id);
        if (!clickedUnit) return;

        console.log(`Clicked unit: ${id}`, clickedUnit);

        // Find units in the same stack (very close proximity)
        const stackThreshold = 60; // Increased threshold
        const stackUnits = units.filter(u =>
            Math.abs(u.x - clickedUnit.x) < stackThreshold &&
            Math.abs(u.y - clickedUnit.y) < stackThreshold
        );

        console.log(`Found ${stackUnits.length} units in stack.`);

        if (stackUnits.length <= 1) return; // No stack to rotate

        // Sort stack units by visual order (Y then X ascending)
        // Smaller X/Y = "Back", Larger X/Y = "Front"
        const sortedStackUnits = [...stackUnits].sort((a, b) => (a.y - b.y) || (a.x - b.x));

        // Find current index of clicked unit in the sorted stack
        const currentIndex = sortedStackUnits.findIndex(u => u.id === id);
        console.log(`Current index in stack: ${currentIndex} / ${sortedStackUnits.length - 1}`);

        // We want to move the Currently Clicked Unit (presumably the top/last one visually)
        // to the BOTTOM (index 0). And shift everyone else up.
        // Actually, let's just cycle the positions:
        // Position[i] takes the unit from sortedStackUnits[(i + 1) % N]
        // This shifts units "Left/Up" in the array (Towards 0).
        // The unit at 0 moves to N-1 (Top). Wait, that brings back to front.

        // To "send to back": The unit at Top (N-1) should go to Bottom (0).
        // Unit at 0 should go to 1.

        // Let's capture the POSITIONS.
        const positions = sortedStackUnits.map(u => ({ x: u.x, y: u.y }));

        // Map new units state
        const newUnits = units.map(u => {
            // Is this unit in the stack?
            const stackIdx = sortedStackUnits.findIndex(s => s.id === u.id);
            if (stackIdx === -1) return u;

            // It is in the stack. Logic:
            // If stackIdx is Top (N-1), it moves to Pos 0.
            // If stackIdx is k, it moves to Pos k+1.

            // This assumes the clicked unit IS the top unit.
            // If the user clicks a unit in the middle (because top is transparent?), this still cycles.

            let newPosIdx;
            if (stackIdx === sortedStackUnits.length - 1) {
                newPosIdx = 0;
            } else {
                newPosIdx = stackIdx + 1;
            }

            return {
                ...u,
                x: positions[newPosIdx].x,
                y: positions[newPosIdx].y
            };
        });

        console.log("Rotating stack...");
        setUnits(newUnits);
    };

    const handleEndPhase = () => {
        setUnits(units.map(u => ({ ...u, status: 'fresh' })));

        // Reset Used Support Units (return to supply pool)
        setSupportUnits(prev => {
            const next = {};
            Object.keys(prev).forEach(key => {
                next[key] = { ...prev[key], used: 0 };
            });
            return next;
        });

        console.log("End Phase: Units refreshed, Used Support Cleared.");
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
        let reinforcementCount = 0;

        unitsData.forEach((u) => {
            if (u.startArea === "Reinforcements" || !u.startArea) {
                // Stack compactly in Reinforcement box
                const count = reinforcementCount;
                const offsetX = (count % 5) * 5;
                const offsetY = Math.floor(count / 5) * 5;

                usUnits.push({
                    ...u,
                    x: 4000 + offsetX,
                    y: 3600 + offsetY,
                    status: 'fresh'
                });
                reinforcementCount++;
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
        // Setup JP Units
        // Iterate through all map areas
        const excludeKeywords = ["Turn", "Record", "Morale", "Supply", "Reinforcements", "Chits", "OOA", "Elevated"];
        const excludeExactAreas = ["Area 1", "Area 2", "Area 30"];

        mapData.forEach(area => {
            // Check if this area needs a unit
            // 1. Keyword check (Partial match logic for tracks etc)
            if (excludeKeywords.some(k => area.name.includes(k))) return;
            // 2. Exact area check (Prevent including Area 10, 20 etc by accident)
            if (excludeExactAreas.includes(area.name)) return;

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

    const handleUnitDragStart = (id) => {
        setHoveredStack(null); // Clear tooltip
        // Optional: Bring to front logic (handled by Konva usually)
    };

    const handleUnitHover = (unit, isHovering, pointer) => {
        if (isHovering) {
            // Find all units in stack
            const stackThreshold = 60;
            const stackUnits = units.filter(u =>
                Math.abs(u.x - unit.x) < stackThreshold &&
                Math.abs(u.y - unit.y) < stackThreshold
            );
            // Sort by visual order (same as render/click logic)
            const sortedStack = [...stackUnits].sort((a, b) => (a.y - b.y) || (a.x - b.x));

            setHoveredStack({ units: sortedStack, pointer });
        } else {
            setHoveredStack(null);
        }
    };

    // Calculate stack indices for rendering
    // Sort units by Y then X for consistent rendering
    const sortedUnits = [...units].sort((a, b) => a.y - b.y || a.x - b.x);

    // Calculate stack index (0, 1, 2...) for offset
    const stackMap = {};
    const STACK_THRESHOLD = 40;

    // Simple greedy clustering for stack count
    // NOTE: This runs every render, might be slow for 1000 units but fine for 50.
    // For offset, we just need to know "how many *other* units are at roughly this spot".

    // Reset counters
    const tempCounters = {};
    sortedUnits.forEach(u => {
        // Find a representative key for the stack (e.g. rounded coordinates)
        // Or simply iterate and check proximity?
        // Let's use simple proximity to "previous" units in sorted list
        // Since they are sorted by position, stacked units are adjacent in list!
        // No, because id-based sort is robust, position sort is fluctuating? 
        // Actually, we specifically want to offset based on "how many units are under me".

        let stackIndex = 0;
        // Check only against previously processed units?
        // No, we need to know the *total* count to maybe center it?
        // But for simply cascading (0, 1, 2), we can just count how many "before me" are close.

        // This is O(N^2) in worst case, but N=50 is tiny.
        const nearby = sortedUnits.filter(other =>
            other.id !== u.id &&
            Math.abs(other.x - u.x) < STACK_THRESHOLD &&
            Math.abs(other.y - u.y) < STACK_THRESHOLD
        );

        // However, we want a stable index.
        // If we simply count "how many nearby units have logic index < my logic index"?
        // Let's use the index in the `sortedUnits` array as the tiebreaker.

        const myRank = nearby.filter(other => {
            // Compare identifying correlation (e.g. ID string or just original index)
            // Let's use ID string comparison for stability
            return other.id < u.id;
        }).length;

        stackMap[u.id] = myRank;
    });

    return (
        <div onContextMenu={(e) => e.preventDefault()} style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: '#222' }}>

            {/* LEFT PANEL: Controls & Status (20%) */}
            <div style={{
                flex: '0 0 20%',
                background: '#1e1e1e',
                borderRight: '1px solid #444',
                padding: '1rem',
                color: '#eee',
                overflowY: 'auto',
                boxSizing: 'border-box'
            }}>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '1.5rem', color: '#ffcc00' }}>Manila 1945</h2>

                <div style={{ paddingBottom: '1rem', borderBottom: '1px solid #444', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', marginBottom: '5px' }}>
                        Backend: <span style={{ color: backendStatus === 'healthy' ? '#0f0' : '#f00' }}>{backendStatus}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
                        Map WxH: {mapSize.width} x {mapSize.height}<br />
                        Scale: {scale.toFixed(4)}<br />
                        Pos: {position.x.toFixed(0)}, {position.y.toFixed(0)}
                    </div>
                    {/* Fallback raw image check */}
                    <div style={{ marginTop: '5px', border: '1px solid white', width: '50px', height: '50px', overflow: 'hidden' }}>
                        <img src="/map.jpg" alt="Check" style={{ width: '100%' }} />
                    </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <strong>Selected Area:</strong>
                    {selectedArea ? (
                        <div style={{ marginTop: '5px', padding: '10px', background: '#333', borderRadius: '4px' }}>
                            <div style={{ fontSize: '1.2rem', color: '#00ccff', fontWeight: 'bold' }}>{selectedArea.name}</div>
                            <div style={{ color: '#aaa', marginTop: '5px' }}>Terrain: {selectedArea.terrain}</div>
                        </div>
                    ) : (
                        <div style={{ color: '#777', fontStyle: 'italic', marginTop: '5px' }}>Click an area on the map...</div>
                    )}
                </div>

                <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '1.5rem' }}>
                    <strong>Controls:</strong><br />
                    • Wheel to Zoom<br />
                    • Drag to Pan<br />
                    • Click Stack to Rotate<br />
                    • Double-click Unit to Flip
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    <button
                        onClick={handleStartGame}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#d32f2f', // Red
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                    >
                        Start Game
                    </button>
                    <button
                        onClick={handleEndPhase}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#0066cc', // Blue
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                    >
                        End Phase
                    </button>
                </div>
            </div>

            {/* CENTER PANEL: Map Stage (60%) */}
            <div style={{
                flex: '0 0 60%',
                position: 'relative',
                background: '#333',
                overflow: 'hidden'
            }}>
                {/* Check if Hovered Stack Overlay needs to be here */}
                {/* Stack View Overlay - Positioned Absolute relative to this container works if pointer is relative to Stage */}
                {hoveredStack && (
                    <div style={{
                        position: 'absolute',
                        top: hoveredStack.pointer.y + 20,
                        left: hoveredStack.pointer.x + 20,
                        zIndex: 100,
                        pointerEvents: 'none',
                        background: 'rgba(0,0,0,0.85)',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #999',
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '8px',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
                    }}>
                        {hoveredStack.units.map(u => (
                            <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <img
                                    src={`/images/${(u.status === 'spent' && u.backImage) ? u.backImage : u.frontImage}`}
                                    alt={u.id}
                                    style={{ width: '100px', height: '100px', borderRadius: '4px' }}
                                />
                                <div style={{ color: '#eee', fontSize: '0.75rem', marginTop: '4px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {u.id}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

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

                        {/* Units Render Loop */}
                        {sortedUnits.map((unit) => (
                            <UnitCounter
                                key={unit.id}
                                unit={unit}
                                x={unit.x}
                                y={unit.y}
                                indexInStack={stackMap[unit.id] || 0}
                                onDragStart={handleUnitDragStart}
                                onDragEnd={handleUnitDragEnd}
                                onClick={handleUnitClick}
                                onDblClick={handleUnitDblClick}
                                onHover={handleUnitHover}
                            />
                        ))}
                    </Layer>
                </Stage>
            </div>

            {/* RIGHT PANEL: Counters & Resources (20%) */}
            <div style={{
                flex: '0 0 20%',
                background: '#1e1e1e',
                borderLeft: '1px solid #444',
                padding: '1rem',
                color: '#eee',
                overflowY: 'auto',
                boxSizing: 'border-box'
            }}>
                <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '5px', color: '#ff9900' }}>Resources</h3>

                <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>

                    {/* Turn (Static for now) */}
                    <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Turn</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>1</div>
                    </div>

                    {/* Supply (Interactive) */}
                    <div style={{ background: '#333', padding: '10px', borderRadius: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>US Supply</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4caf50' }}>{supplyPoints}</div>
                            <div style={{ display: 'flex', gap: '2px' }}>
                                <button onClick={() => handleAdjustSupply(1)} style={{ padding: '2px 6px', fontSize: '0.8rem', cursor: 'pointer' }}>+</button>
                                <button onClick={() => handleAdjustSupply(-1)} style={{ padding: '2px 6px', fontSize: '0.8rem', cursor: 'pointer' }}>-</button>
                            </div>
                        </div>
                    </div>

                    {/* Morale (Static) */}
                    <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>US Morale</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2196f3' }}>19 (Strong)</div>
                    </div>

                    {/* Control (Static) */}
                    <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>US Control</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ff9800' }}>{usControl} (Goal: 34)</div>
                    </div>
                </div>

                <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '5px', color: '#ff9900' }}>Support Units</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {Object.values(supportUnits).map(unit => (
                        <div key={unit.type} style={{ background: '#2a2a2a', padding: '10px', borderRadius: '4px', border: '1px solid #555' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <span style={{ fontWeight: 'bold', color: '#ddd' }}>{unit.name}</span>
                                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Cost: {unit.cost}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                                <div>Avail: <span style={{ color: '#fff' }}>{unit.available}</span> <span style={{ color: '#666' }}>/ {unit.max}</span></div>
                                <div>Used: <span style={{ color: '#fa8' }}>{unit.used}</span></div>
                            </div>

                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                    onClick={() => handleBuySupport(unit.type)}
                                    disabled={supplyPoints < unit.cost || (unit.available + unit.used) >= unit.max}
                                    style={{
                                        flex: 1,
                                        padding: '5px',
                                        cursor: 'pointer',
                                        background: (supplyPoints >= unit.cost && (unit.available + unit.used) < unit.max) ? '#2e7d32' : '#555',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        opacity: (supplyPoints >= unit.cost && (unit.available + unit.used) < unit.max) ? 1 : 0.5
                                    }}
                                >
                                    Buy
                                </button>
                                <button
                                    onClick={() => handleUseSupport(unit.type)}
                                    disabled={unit.available <= 0}
                                    style={{
                                        flex: 1,
                                        padding: '5px',
                                        cursor: 'pointer',
                                        background: unit.available > 0 ? '#d84315' : '#555',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        opacity: unit.available > 0 ? 1 : 0.5
                                    }}
                                >
                                    Use
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '5px', color: '#ff9900' }}>Out of Action</h3>
                <div style={{ background: '#2a2a2a', padding: '20px', borderRadius: '4px', textAlign: 'center', border: '1px dashed #555' }}>
                    <div style={{ color: '#777', fontStyle: 'italic' }}>No units lost</div>
                </div>
            </div>

        </div>
    );
}

export default App;
