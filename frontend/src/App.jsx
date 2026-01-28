import { useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Text, Group, Rect, Circle } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import unitsData from './units_data.json';
import japaneseUnitsData from './japanese_units_data.json';
import mapData from './map_data.json';
import adjacencyData from './adjacency.json';
import CombatModal from './components/CombatModal';


// High-DPI setting
Konva.pixelRatio = window.devicePixelRatio || 1;

const UNIT_SIZE = 100;

const UnitCounter = ({ unit, x, y, indexInStack, isSelected, onDragStart, onDragEnd, onClick, onDblClick, onHover, onContextMenu }) => {
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
            onContextMenu={(e) => {
                e.evt.preventDefault(); // Prevent browser context menu
                onContextMenu && onContextMenu(e.evt, unit.id);
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
                stroke={isSelected ? "yellow" : (isSpent ? "red" : "black")}
                strokeWidth={isSelected ? 4 : (isSpent ? 2 : 1)}
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
    // Combat State
    const [showCombatModal, setShowCombatModal] = useState(false);
    const [combatData, setCombatData] = useState(null);
    const [stageSize, setStageSize] = useState({ width: Math.floor(window.innerWidth * 0.6), height: window.innerHeight });
    const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(0.25); // Zoom out a bit more initially
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const [units, setUnits] = useState([]);

    // Initialization
    useEffect(() => {
        if (units.length > 0) return;

        const initialUnits = [];

        // 1. Load US Units
        unitsData.forEach((u, i) => {
            initialUnits.push({
                ...u,
                status: 'fresh',
                x: 100 + (i % 5) * 60,
                y: 100 + Math.floor(i / 5) * 110,
                faction: 'US',
                location: 'Area 1' // Default start
            });
        });

        // 2. Load JP Units (1 per Urban/Fort Area)
        let jpIdx = 0;
        mapData.forEach(area => {
            if (['Urban', 'Fort'].includes(area.terrain)) {
                const candidates = japaneseUnitsData.filter(ju => ju.terrainType === area.terrain);
                if (candidates.length > 0) {
                    const template = candidates[Math.floor(Math.random() * candidates.length)];
                    initialUnits.push({
                        ...template,
                        id: `jp_${area.name.replace(/\s/g, '')}_${jpIdx++}`,
                        name: template.name, // Keep generic name until reveal?
                        status: 'hidden',
                        x: area.points[0] + 50, // Approximate center placement
                        y: area.points[1] + 50,
                        faction: 'JP',
                        location: area.name
                    });
                }
            }
        });

        setUnits(initialUnits);
        console.log("Initialized Units:", initialUnits.length);
    }, []);

    // Restore missing state
    const [selectedArea, setSelectedArea] = useState(null);
    const [hoveredArea, setHoveredArea] = useState(null);
    const [hoveredStack, setHoveredStack] = useState(null); // { units: [], pointer: {x, y} }
    const [backendStatus, setBackendStatus] = useState('Checking...');
    const [usControlledAreas, setUsControlledAreas] = useState(['Area 1', 'Area 2', 'Area 30']); // Track actual area names
    const [validRecoveryAreas, setValidRecoveryAreas] = useState([]); // Areas to highlight for recovery
    // Context Menu State
    const [contextMenu, setContextMenu] = useState(null); // { x, y, unitId }



    // Game Phase State
    const [turn, setTurn] = useState(1);
    const [currentPhase, setCurrentPhase] = useState('Setup'); // Setup, Dawn, Event, Supply, Combat, End

    // Click-to-Move State
    const [selectedUnitId, setSelectedUnitId] = useState(null);
    const [movementOptions, setMovementOptions] = useState([]); // Array of area names
    const [morale, setMorale] = useState(19);
    const [hasBeenShaken, setHasBeenShaken] = useState(false); // Rule 11.6: Air Support unlock
    const [supplyRolled, setSupplyRolled] = useState(false); // Track if roll logic is done this turn
    const [bloodyStreetsQueue, setBloodyStreetsQueue] = useState([]);
    const [contestedAreas, setContestedAreas] = useState([]); // Array of area names with '⚔️'

    // Event State
    const [currentEvent, setCurrentEvent] = useState(null);
    const [lastEvent, setLastEvent] = useState(null); // Keeps track of important previous events (Pause)

    // Helper: Determine US Controlled Tags
    const getUsControlledTags = () => {
        const tags = new Set();
        usControlledAreas.forEach(name => {
            const area = mapData.find(a => a.name === name);
            if (area && area.terrain) {
                tags.add(area.terrain);
            }
        });
        return Array.from(tags);
    };

    // Phase Handlers
    const handleEventPhase = async () => {
        try {
            const tags = getUsControlledTags();
            const res = await fetch('/api/phase/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentTurn: turn,
                    units: units,
                    morale: morale,
                    lastEvent: lastEvent,
                    usControlledTags: tags
                })
            });

            const data = await res.json();

            // Update State
            setCurrentEvent(data.event);

            // Only update lastEvent if it's a Pause (to track consecutive pauses correctly)
            // If we overwrite with "No Result", we lose history of the previous pause?
            // Rule Says: "If the same US Division... is selected for a SECOND consecutive Turn..."
            // This implies we compare Turn N result with Turn N-1 result.
            // If Turn 2 was "Pause 1st Cav", and Turn 3 is "No Result", then Turn 4 rolls "Pause 1st Cav"...
            // Is that consecutive? No, because Turn 3 was No Result.
            // So we SHOULD update lastEvent every turn, even if No Result.
            // Wait, "Consecutive Turn" means T and T+1. 
            // So yes, we overwrite lastEvent every turn.
            setLastEvent(data.event);

            if (data.morale !== morale) {
                setMorale(data.morale);
                // Alert after state update
                setTimeout(() => alert(`Morale Change: Now ${data.morale}`), 100);
            }

            if (data.logs.length > 0) {
                console.log("Event Phase Logs:", data.logs);
                setTimeout(() => alert("Event Result:\n" + data.event.name + "\n\n" + data.logs.join('\n')), 200);
            }

            // Ready to proceed to next phase (Supply) manually

        } catch (e) {
            console.error("Event API Error", e);
            alert("Error processing Event Phase.");
        }
    };

    // Proceed to Supply
    const handleProceedToSupply = () => {
        setCurrentPhase('Supply');
    };

    // Proceed to Action Phase (from Supply)
    const handleProceedToAction = () => {
        setCurrentPhase('Action');
        setContestedAreas([]);
        // recalculateContestedAreas(); // Dynamic now
    };

    const handleEndTurn = () => {
        if (!window.confirm("End Action Phase and finish Turn?")) return;
        setCurrentPhase('End');
        // Logic for next turn would go here
    };

    const recalculateContestedAreas = () => {
        // Find all areas where US and JP units coexist
        const newContested = [];
        mapData.forEach(area => {
            const hasUS = units.some(u => u.faction === 'US' && !['out_of_action', 'eliminated'].includes(u.status) && (u.location === area.name || isPointInPolygon(u.x, u.y, area.points)));
            const hasJP = units.some(u => u.faction === 'JP' && !['out_of_action', 'eliminated'].includes(u.status) && (u.location === area.name || isPointInPolygon(u.x, u.y, area.points)));

            if (hasUS && hasJP) {
                newContested.push(area.name);
            }
        });
        setContestedAreas(newContested);
    };

    // --- Strategy Casualty Handler (Instant) ---
    const handleStrategyCasualty = async (casualtyIds) => {
        // Immediate Backend Call
        try {
            await fetch('/api/combat/apply_result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resultType: 'StrategyCasualty',
                    attackerUnits: [], // Not needed for this type
                    defenderUnit: null,
                    targetArea: '',
                    currentMorale: morale,
                    strategyCasualtyIds: casualtyIds
                })
            });
            console.log(`Strategy Casualties Applied: ${casualtyIds.join(', ')}`);
        } catch (e) {
            console.error("Strategy Casualty API Error", e);
        }

        // Immediate Frontend Update
        setUnits(prev => prev.map(u => {
            if (casualtyIds.includes(u.id)) {
                return { ...u, status: 'out_of_action' };
            }
            return u;
        }));
    };


    const handleDawnPhase = async () => {
        try {
            const res = await fetch('/api/phase/dawn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentTurn: turn, units: units, morale: morale })
            });
            if (!res.ok) throw new Error("API Call Failed");

            const data = await res.json();

            // Log messages to user
            console.log("Dawn Phase Results:", data.logs);
            if (data.logs.length > 0) {
                alert("Dawn Phase Report:\n" + data.logs.join('\n'));
            }

            // Update State
            setUnits(data.units);
            setMorale(data.morale);
            setCurrentPhase('Event'); // Advance to Event Phase
        } catch (e) {
            console.error(e);
            alert("Error processing Dawn Phase. Is backend running?");
        }
    };


    // Supply Phase Logic
    const handleSupplyRoll = async () => {
        try {
            const res = await fetch('/api/phase/supply/roll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentTurn: turn, currentSupply: supplyPoints })
            });
            const data = await res.json();

            setSupplyPoints(data.new_total);
            setSupplyRolled(true);

            if (data.logs.length > 0) {
                alert("Supply Roll Results:\n" + data.logs.join('\n'));
            }
        } catch (e) {
            console.error("Supply Roll Error", e);
            alert("Error rolling for supply.");
        }
    };

    // Auto-check Morale Shaken status
    useEffect(() => {
        if (morale <= 9 && !hasBeenShaken) {
            console.log("Morale Shaken! Air Support Unlocked.");
            setHasBeenShaken(true);
        }
    }, [morale, hasBeenShaken]);

    // Improve Morale Action
    const handleImproveMorale = () => {
        if (supplyPoints >= 3 && morale < 19) {
            setSupplyPoints(prev => prev - 3);
            setMorale(prev => prev + 1);
        }
    };

    // --- Bloody Streets Logic ---
    const checkBloodyStreets = async () => {
        // Build Area Data
        const areaData = mapData.map(area => {
            const areaUnits = units.filter(u =>
                !['out_of_action', 'eliminated', 'wounded', 'future'].includes(u.status) &&
                isPointInPolygon(u.x, u.y, area.points)
            );
            return {
                name: area.name,
                terrain: area.terrain,
                us_count: areaUnits.filter(u => u.faction !== 'JP').length,
                jp_count: areaUnits.filter(u => u.faction === 'JP').length
            };
        });

        try {
            const res = await fetch('/api/phase/bloody_streets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ areaData })
            });
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                console.log("Bloody Streets Events:", data.results);
                setBloodyStreetsQueue(data.results);
                alert("⚠️ Bloody Streets detected! Resolve casualties before Combat Phase.");
            } else {
                console.log("No Bloody Streets events.");
                setCurrentPhase('Combat');
            }

            if (data.logs.length > 0) {
                console.log(data.logs.join('\n'));
            }
        } catch (e) {
            console.error(e);
            alert("Error checking Bloody Streets.");
            setCurrentPhase('Combat'); // Fallback
        }
    };

    const handleBloodyStreetsSelection = (unitId) => {
        const currentEvent = bloodyStreetsQueue[0];
        if (!currentEvent) return;

        const unit = units.find(u => u.id === unitId);
        if (!unit) return;

        // Validation
        if (unit.faction === 'JP') {
            alert("Must select a US unit for casualties.");
            return;
        }
        const area = mapData.find(a => a.name === currentEvent.area);
        if (!area || !isPointInPolygon(unit.x, unit.y, area.points)) {
            alert(`Selected unit must be in ${currentEvent.area}!`);
            return;
        }

        // Apply Morale Penalty (Once per event)
        if (currentEvent.morale_penalty > 0) {
            setMorale(prev => prev - currentEvent.morale_penalty);
            // alert(`Bloody Streets Effect: Morale -${currentEvent.morale_penalty}`);
        }

        // Apply OOA
        setUnits(prev => prev.map(u => u.id === unitId ? { ...u, status: 'out_of_action' } : u));

        // Advance
        const newQueue = bloodyStreetsQueue.slice(1);
        setBloodyStreetsQueue(newQueue);

        if (newQueue.length === 0) {
            alert("Bloody Streets resolution complete. Beginning Combat Phase.");
            setCurrentPhase('Combat');
        }
    };

    // Proceed to Combat
    const handleProceedToCombat = () => {
        setSupplyRolled(false);
        checkBloodyStreets();
    };

    // --- Combat Logic ---
    const handleCombatInitiation = (areaName) => {
        // Find units in this area
        const areaUnits = units.filter(u => u.location === areaName && u.status !== 'eliminated' && u.status !== 'out_of_action');
        const attackers = areaUnits.filter(u => u.faction === 'US');
        const defenders = areaUnits.filter(u => u.faction === 'JP');

        if (attackers.length === 0) return; // No US units
        if (defenders.length === 0) return; // No Enemy (Control Logic?)

        // Setup Data
        const area = mapData.find(a => a.name === areaName);
        setCombatData({
            attackerUnits: attackers,
            defenderUnit: defenders[0], // Assume 1 per area for now
            terrain: area ? area.terrain : 'Clear',
            areaName: areaName
        });
        setShowCombatModal(true);
    };

    const handleCombatApply = async (result) => {
        console.log("Applying Combat Result:", result);

        // 1. Call Backend API to finalize state/logs (Optional, done mostly in frontend logic below but better to sync)
        try {
            await fetch('/api/combat/apply_result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resultType: result.resultType,
                    attackerUnits: result.attackerUnits,
                    defenderUnit: result.defenderUnit,
                    targetArea: combatData.areaName,
                    currentMorale: morale
                })
            });
        } catch (e) {
            console.error("API Apply Error", e);
        }

        // 2. Update Local State based on Result
        // Update updated units
        const updatedIds = new Set();
        const updates = {};

        if (result.attackerUnits) {
            result.attackerUnits.forEach(u => {
                updatedIds.add(u.id);
                updates[u.id] = u;
            });
        }
        if (result.defenderUnit) {
            updatedIds.add(result.defenderUnit.id);
            updates[result.defenderUnit.id] = result.defenderUnit;
        }

        setUnits(prev => prev.map(u => {
            if (updatedIds.has(u.id)) {
                return { ...u, ...updates[u.id] };
            }
            return u;
        }));

        // Update Morale
        if (result.currentMorale !== undefined) {
            // Logic in Modal might pass NEW morale or CURRENT?
            // My implementation in Modal passed `currentMorale: morale` (old).
            // But backend returns `new_morale`.
            // Ideally we use backend response.
            // But for now, let's just decrement if Repulse?
            // Wait, `apply_combat_result` API calc is better.
            // Let's rely on API response if possible.
            // But here I didn't wait for API response data.

            // Simple fallback: If resultType is Repulse, -1.
            if (result.resultType === 'Repulse') {
                setMorale(m => m - 1);
            }
        }

        // Update Control
        if (result.resultType === 'Success' || result.resultType === 'Overrun') {
            setUsControlledAreas(prev => Array.from(new Set([...prev, combatData.areaName])));
        }

        setShowCombatModal(false);
        setCombatData(null);
    };



    // Recover Unit Handler
    const handleRecoverUnit = (unitId) => {
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;

        // Cost logic (Simple for now: 2 points)
        // TODO: HQ/Leader check for 0 cost
        const cost = 2; // Default

        if (supplyPoints >= cost) {
            setSupplyPoints(prev => prev - cost);
            setUnits(prev => prev.map(u => {
                if (u.id === unitId) {
                    return {
                        ...u,
                        status: 'fresh',
                        x: 100, // Spawn at top-left logic or specific area
                        y: 100
                    };
                }
                return u;
            }));
            setContextMenu(null); // Close menu
        } else {
            alert("Not enough supply options!");
        }
    };

    const handleRemoveUnit = (unitId) => {
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;

        // Japanese Units -> Eliminate
        if (unit.faction === 'JP') {
            setUnits(prev => prev.filter(u => u.id !== unitId));
            setContextMenu(null);
            return;
        }

        // Leader Casualty Check (US)
        // Heuristic: Check for specific Commander names or 'HQ'
        const isLeader = /HQ|Gen|Leader|Beightler|Chase|Haugen|Griswold/i.test(unit.name) || /HQ/i.test(unit.id);

        if (false) { // Leader check disabled (deferred to Dawn Phase)
            const roll = Math.floor(Math.random() * 6) + 1;
            let msg = `Leader Casualty Check (${unit.name}): Rolled ${roll}\n\n`;

            if (roll <= 2) {
                msg += "Result: KIA (1-2). Unit eliminated.";
                alert(msg);
                setUnits(prev => prev.filter(u => u.id !== unitId));
            } else if (roll <= 4) {
                msg += "Result: Wounded (3-4). Evacuated (Returns next turn).";
                alert(msg);
                setUnits(prev => prev.map(u => u.id === unitId ? { ...u, status: 'wounded' } : u));
            } else {
                msg += "Result: Superficial (5-6). Immediate recovery!";
                alert(msg);
                // No status change
            }
        }
        // Normal US Unit -> OOA
        setUnits(prev => prev.map(u => u.id === unitId ? { ...u, status: 'out_of_action' } : u));

        setContextMenu(null);
    };

    const handleUnitContextMenu = (e, unitId) => {
        // e is already the native event (passed from UnitCounter)
        setContextMenu({
            x: e.clientX,
            y: e.clientY,

            unitId,
            type: 'unit' // Changed from 'remove' to generic 'unit' to support more options
        });
    };

    const handleToggleControl = (areaName) => {
        if (usControlledAreas.includes(areaName)) {
            setUsControlledAreas(prev => prev.filter(n => n !== areaName));
        } else {
            setUsControlledAreas(prev => [...prev, areaName]);
        }
        setContextMenu(null);
    };

    const handleAreaContextMenu = (e, areaName) => {
        e.cancelBubble = true;
        e.evt.preventDefault();
        setContextMenu({
            x: e.evt.clientX,
            y: e.evt.clientY,
            areaName, // specific property for Area actions
            type: 'area'
        });
    };

    // Close menu on click anywhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

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

    // Buy Support Logic
    const handleBuySupport = (type) => {
        // Can only buy in Supply Phase
        if (currentPhase !== 'Supply') return;

        const unit = supportUnits[type];
        if (!unit) return;

        // Air Support only if unlocked
        if (type === 'air' && !hasBeenShaken) {
            alert("Air Support is locked until US Morale drops to 9 (Shaken).");
            return;
        }

        // Check supply and max limit (Total = available + used)
        // Rule: Can buy up to limit.
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
        // Find which area this is
        const area = mapData.find(a => isPointInPolygon(newX, newY, a.points));
        const locationName = area ? area.name : 'Unknown';

        // Update position
        setUnits(prev => {
            const nextUnits = prev.map(u => u.id === id ? { ...u, x: newX, y: newY, location: locationName, status: u.status === 'fresh' ? 'fresh' : u.status } : u);

            // Action Phase Logic: Check contact
            if (currentPhase === 'Action') {
                // Check if this area has JP units
                const hasJP = nextUnits.some(u => u.faction === 'JP' && !['out_of_action', 'eliminated'].includes(u.status) && u.location === locationName);
                if (hasJP) {
                    // Mark contested
                    setContestedAreas(prevCA => {
                        if (!prevCA.includes(locationName)) return [...prevCA, locationName];
                        return prevCA;
                    });
                }
            }
            return nextUnits;
        });

        console.log(`Moved unit ${id} to ${locationName}`);
    };

    const handleUnitDblClick = (id) => {
        setUnits(units.map(u => {
            if (u.id === id) {
                return { ...u, status: u.status === 'fresh' ? 'spent' : 'fresh' };
            }
            return u;
        }));
    };

    const handleMoveSelect = (targetAreaName) => {
        if (!selectedUnitId) return;
        const targetArea = mapData.find(a => a.name === targetAreaName);
        if (!targetArea) return;

        // Calculate new X/Y (Centroid or random offset in area)
        const centroid = getCentroid(targetArea.points);
        // Add random jitter to avoid perfect stacking
        const jitter = 20;
        const newX = centroid.x + (Math.random() * jitter - jitter / 2);
        const newY = centroid.y + (Math.random() * jitter - jitter / 2);

        // Execute Move
        handleUnitDragEnd(selectedUnitId, newX, newY); // Reuse logic

        // Reset Selection
        setSelectedUnitId(null);
        setMovementOptions([]);
    };

    const handleUnitClick = (id) => {
        // Bloody Streets Interception
        if (bloodyStreetsQueue.length > 0) {
            handleBloodyStreetsSelection(id);
            return;
        }

        const clickedUnit = units.find(u => u.id === id);
        if (!clickedUnit) return;

        console.log(`Clicked unit: ${id}`, clickedUnit);

        // --- Click-to-Move Logic (Action Phase & US & Fresh) ---
        if (currentPhase === 'Action' && clickedUnit.faction === 'US' && clickedUnit.status === 'fresh') {
            // If already selected, deselect? Or maybe rotate stack? 
            // Let's toggle selection.
            if (selectedUnitId === id) {
                setSelectedUnitId(null);
                setMovementOptions([]);
                return;
            }

            // Select Unit
            setSelectedUnitId(id);

            // Calculate Options
            const currentLoc = clickedUnit.location;
            const adjacent = adjacencyData[currentLoc] || [];

            // Filter valid options (exclude impassable, etc)
            // Rule: Check Stacking Limit (max 6 US units in target)
            const validOptions = adjacent.filter(adjName => {
                // Stacking Check
                const unitsInTarget = units.filter(u => u.faction === 'US' && u.location === adjName && !['out_of_action', 'eliminated'].includes(u.status));
                if (unitsInTarget.length >= 6) return false;

                // Impassable Check (River) -> Using Map Data 'terrain'? Or Adjacency already handles it?
                // The generator removed Pasig River links (11/12 <-> 37).
                // So adjacency list is trusted.
                return true;
            });

            console.log(`Movement Options for ${currentLoc}:`, validOptions);
            setMovementOptions(validOptions);
            return; // Skip stack rotation if selecting for move
        }

        // --- Standard Stack Rotation Logic (Fallback) ---
        // Find units in the same stack (very close proximity)
        const stackThreshold = 60; // Increased threshold
        const stackUnits = units.filter(u =>
            Math.abs(u.x - clickedUnit.x) < stackThreshold &&
            Math.abs(u.y - clickedUnit.y) < stackThreshold
        );

        if (stackUnits.length <= 1) return; // No stack to rotate

        // Sort stack units by visual order (Y then X ascending)
        const sortedStackUnits = [...stackUnits].sort((a, b) => (a.y - b.y) || (a.x - b.x));
        const positions = sortedStackUnits.map(u => ({ x: u.x, y: u.y }));

        // Map new units state
        const newUnits = units.map(u => {
            const stackIdx = sortedStackUnits.findIndex(s => s.id === u.id);
            if (stackIdx === -1) return u;

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

        // Advance Turn Logic
        setTurn(prev => prev + 1);
        setCurrentPhase('Dawn');
        setCurrentEvent(null); // Clear event for new turn

        console.log("End Phase: Units refreshed, Turn Advanced.");
    };

    // Helper to get division prefix
    const getDivision = (unit) => {
        if (!unit) return null;
        if (unit.name.includes('11-')) return '11-';
        if (unit.name.includes('37-')) return '37-';
        if (unit.name.includes('1-')) return '1-';
        if (unit.name.includes('XIV')) return 'XIV';
        return null;
    };

    // Ray-casting algorithm
    function isPointInPolygon(x, y, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 2; i < poly.length; i += 2) {
            let xi = poly[i], yi = poly[i + 1];
            let xj = poly[j], yj = poly[j + 1];
            let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
            j = i;
        }
        return inside;
    };

    const handleOOAHover = (unit, isHovering) => {
        if (!isHovering) {
            setValidRecoveryAreas([]);
            return;
        }

        const division = getDivision(unit);
        const validSet = new Set();

        // Rule B: Initial Areas - Only the specific start area of this unit
        // Must be US Controlled to be safe for deployment
        if (unit.startArea && usControlledAreas.includes(unit.startArea)) {
            validSet.add(unit.startArea);
        }

        // Rule A: Same Division in US Controlled Area
        if (division) {
            const divisionUnits = units.filter(u =>
                !['out_of_action', 'eliminated', 'wounded'].includes(u.status) &&
                getDivision(u) === division
            );

            usControlledAreas.forEach(areaName => {
                const area = mapData.find(a => a.name === areaName);
                if (!area) return;

                const hasFriend = divisionUnits.some(u => isPointInPolygon(u.x, u.y, area.points));
                if (hasFriend) {
                    validSet.add(areaName);
                }
            });
        }
        setValidRecoveryAreas(Array.from(validSet));
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
                // Future Reinforcements - Hidden until Dawn Phase triggers
                usUnits.push({
                    ...u,
                    x: 0,
                    y: 0,
                    status: 'future'
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
                    status: 'fresh', // fresh = hidden/chit side
                    location: area.name // Explicitly set location
                });
            }
        });

        setUnits(newUnits);

        // Initialize Game State
        setTurn(1);
        setCurrentPhase('Dawn');
        setMorale(19);

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
    const mapUnits = units.filter(u => !['out_of_action', 'eliminated', 'wounded', 'future'].includes(u.status));
    const sortedUnits = [...mapUnits].sort((a, b) => a.y - b.y || a.x - b.x);

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
                </div>

                {/* Game Status Panel */}
                <div style={{ padding: '10px', background: '#333', marginBottom: '1rem', borderRadius: '4px', border: '1px solid #555' }}>
                    <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>
                        Turn {turn}
                    </div>
                    <div style={{ color: '#00ccff', marginBottom: '5px' }}>
                        Phase: {currentPhase}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span>Morale: {morale}</span>
                        <span>Supply: {supplyPoints}</span>
                    </div>

                    {/* Event Display */}
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #555' }}>
                        <div style={{ fontSize: '0.85rem', color: '#aaa' }}>Current Event:</div>
                        {currentEvent ? (
                            <div style={{
                                color: currentEvent.name === 'No Result' ? '#777' : '#ffeb3b',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                marginTop: '3px'
                            }}>
                                {currentEvent.name}
                                {currentEvent.type !== 'No Result' && (
                                    <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#ccc' }}>
                                        ({currentEvent.type}) Roll: {currentEvent.roll}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>None</div>
                        )}
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

                    {currentPhase === 'Dawn' && (
                        <button
                            onClick={handleDawnPhase}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: '#ff9800', // Orange
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold'
                            }}
                        >
                            Execute Dawn Phase
                        </button>
                    )}

                    {currentPhase === 'Event' && !currentEvent && (
                        <button
                            onClick={handleEventPhase}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: '#9c27b0', // Purple
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold'
                            }}
                        >
                            Roll Event
                        </button>
                    )}

                    {currentPhase === 'Event' && currentEvent && (
                        <button
                            onClick={handleProceedToSupply}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: '#4caf50', // Green
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold'
                            }}
                        >
                            To Supply Phase &gt;
                        </button>
                    )}
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

                {bloodyStreetsQueue.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 500,
                        background: 'rgba(50, 0, 0, 0.95)',
                        color: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '2px solid red',
                        boxShadow: '0 0 20px rgba(255, 0, 0, 0.5)',
                        textAlign: 'center',
                        maxWidth: '80%'
                    }}>
                        <h2 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #fff', color: '#ff3333' }}>BLOODY STREETS!</h2>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                            Area: {bloodyStreetsQueue[0].area}
                        </div>
                        <div style={{ margin: '10px 0', fontSize: '1rem' }}>
                            Result: Rolled {bloodyStreetsQueue[0].roll} ({bloodyStreetsQueue[0].effect})
                        </div>
                        <div style={{ color: '#ffaaaa', fontWeight: 'bold' }}>
                            ⚠ Select 1 US Unit in this area to take casualties (OOA).
                        </div>
                        {bloodyStreetsQueue[0].morale_penalty > 0 && (
                            <div style={{ color: '#fa0', fontSize: '0.9rem', marginTop: '5px' }}>
                                (Additional Consequence: Morale -1)
                            </div>
                        )}
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
                        {contestedAreas.map(areaName => {
                            const area = mapData.find(a => a.name === areaName);
                            if (!area) return null;
                            const center = getCentroid(area.points);
                            return (
                                <Text
                                    key={`combat-${areaName}`}
                                    x={center.x - 20}
                                    y={center.y - 20}
                                    text="⚔️"
                                    fontSize={40}
                                    onClick={() => handleCombatInitiation(areaName)}
                                    onTap={() => handleCombatInitiation(areaName)}
                                    listening={currentPhase === 'Action'}
                                />
                            );
                        })}
                        {movementOptions.map(areaName => {
                            const area = mapData.find(a => a.name === areaName);
                            if (!area) return null;
                            const center = getCentroid(area.points);
                            return (
                                <Group
                                    key={`move-${areaName}`}
                                    onClick={() => handleMoveSelect(areaName)}
                                    onTap={() => handleMoveSelect(areaName)}
                                    onMouseEnter={() => document.body.style.cursor = 'pointer'}
                                    onMouseLeave={() => document.body.style.cursor = 'default'}
                                >
                                    <Circle
                                        x={center.x}
                                        y={center.y}
                                        radius={30}
                                        fill="rgba(0, 255, 0, 0.4)"
                                        stroke="lime"
                                        strokeWidth={2}
                                    />
                                    <Text
                                        x={center.x - 20}
                                        y={center.y - 6}
                                        text="MOVE"
                                        fontSize={12}
                                        fill="white"
                                        fontStyle="bold"
                                        width={40}
                                        align="center"
                                        listening={false}
                                    />
                                </Group>
                            );
                        })}
                        {mapData.map((area, i) => (
                            <Line
                                key={i}
                                points={area.points}
                                fill={
                                    validRecoveryAreas.includes(area.name) ? 'rgba(255, 215, 0, 0.4)' :
                                        (usControlledAreas.includes(area.name) ? 'rgba(0, 100, 255, 0.15)' :
                                            (selectedArea?.name === area.name ? 'rgba(255, 0, 0, 0.4)' :
                                                (hoveredArea === area.name ? 'rgba(255, 255, 255, 0.2)' : 'transparent')))
                                }
                                stroke={
                                    validRecoveryAreas.includes(area.name) ? 'rgba(255, 215, 0, 0.8)' :
                                        (usControlledAreas.includes(area.name) ? 'rgba(0, 150, 255, 0.5)' :
                                            (selectedArea?.name === area.name ? 'red' : 'rgba(255,255,0,0.3)'))
                                }
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
                                onClick={() => {
                                    /* if (currentPhase === 'Action') ... */
                                    setSelectedArea(area);
                                }}

                                onContextMenu={(e) => handleAreaContextMenu(e, area.name)}
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
                                isSelected={unit.id === selectedUnitId}
                                onDragStart={handleUnitDragStart}
                                onDragEnd={handleUnitDragEnd}
                                onClick={handleUnitClick}
                                onDblClick={handleUnitDblClick}
                                onHover={handleUnitHover}
                                onContextMenu={handleUnitContextMenu}
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
                        </div>
                    </div>

                    {/* Morale (Static) */}
                    <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>US Morale</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2196f3' }}>19 (Strong)</div>
                    </div>

                    {/* Control (Dynamic) */}
                    <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>US Control</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ff9800' }}>{usControlledAreas.length} (Goal: 34)</div>
                    </div>
                </div>

                {/* Supply Actions */}
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#8bc34a' }}>Supply Actions</h3>
                    <div style={{ padding: '10px', background: '#333', borderRadius: '4px', border: '1px solid #555' }}>
                        {currentPhase === 'Supply' && !supplyRolled && (
                            <div style={{ marginBottom: '10px' }}>
                                <button onClick={handleSupplyRoll} style={{ width: '100%', background: '#ff9800', color: 'white', padding: '8px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                                    Roll Supply (4d6)
                                </button>
                            </div>
                        )}

                        {currentPhase === 'Supply' && supplyRolled && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#ccc', fontStyle: 'italic' }}>
                                    Spend supply points to buy support, recover units, or boost morale.
                                </div>

                                <button
                                    onClick={handleImproveMorale}
                                    disabled={supplyPoints < 3 || morale >= 19}
                                    style={{
                                        width: '100%',
                                        background: supplyPoints >= 3 && morale < 19 ? '#2196f3' : '#555',
                                        color: 'white',
                                        padding: '8px',
                                        border: 'none',
                                        cursor: supplyPoints >= 3 && morale < 19 ? 'pointer' : 'not-allowed',
                                        borderRadius: '4px'
                                    }}
                                >
                                    +1 Morale ($3) {morale >= 19 ? '(Max)' : ''}
                                </button>

                                <hr style={{ borderColor: '#555', width: '100%', margin: '5px 0' }} />

                                <button
                                    onClick={handleProceedToAction}
                                    style={{
                                        width: '100%',
                                        background: '#4caf50',
                                        color: 'white',
                                        padding: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    End Supply Phase (Start Action) &gt;
                                </button>
                            </div>
                        )}

                        {currentPhase === 'Action' && (
                            <div style={{ paddingTop: '10px', borderTop: '1px solid #555', marginTop: '10px' }}>
                                <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px', fontStyle: 'italic' }}>
                                    Move units or Right-Click areas to Resolve Combat.
                                </div>
                                <button
                                    onClick={handleEndTurn}
                                    style={{
                                        width: '100%',
                                        background: '#f44336', // Red
                                        color: 'white',
                                        padding: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    End Action Phase (Finish Turn) &gt;
                                </button>
                            </div>
                        )}


                        {currentPhase !== 'Supply' && (
                            <div style={{ fontSize: '0.8rem', color: '#777' }}>
                                Supply actions available in Supply Phase.
                            </div>
                        )}
                    </div>
                </div >

                <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '5px', color: '#ff9900' }}>Support Units</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {Object.keys(supportUnits).map(key => {
                        const s = supportUnits[key];
                        // Determine if buyable
                        const canBuy = currentPhase === 'Supply' && supplyRolled && supplyPoints >= s.cost && (s.available + s.used) < s.max;
                        // Special lock for Air
                        const isLocked = key === 'air' && !hasBeenShaken;

                        return (
                            <div key={key} style={{ padding: '10px', background: '#2a2a2a', borderRadius: '4px', border: '1px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: '#ddd' }}>{s.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                                        Avail: <span style={{ color: '#fff' }}>{s.available}</span> / Used: <span style={{ color: '#fa8' }}>{s.used}</span> (Max: {s.max})
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Cost: {s.cost}</div>
                                </div>
                                <div>
                                    <button
                                        onClick={() => handleBuySupport(key)}
                                        disabled={!canBuy || isLocked}
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: '0.8rem',
                                            cursor: (!canBuy || isLocked) ? 'not-allowed' : 'pointer',
                                            background: (!canBuy || isLocked) ? '#555' : '#8bc34a',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '2px'
                                        }}
                                    >
                                        Buy
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '5px', color: '#ff9900' }}>Out of Action</h3>
                <div style={{ minHeight: '60px', background: '#2a2a2a', padding: '10px', borderRadius: '4px', border: '1px dashed #555' }}>
                    {units.filter(u => u.status === 'out_of_action').length === 0 ? (
                        <div style={{ color: '#777', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>No units lost</div>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {units.filter(u => u.status === 'out_of_action').map(u => (
                                <img
                                    key={u.id}
                                    src={`/images/${u.frontImage}`}
                                    alt={u.id}
                                    style={{ width: '50px', height: '50px', borderRadius: '4px', cursor: 'context-menu', opacity: 0.8, border: '1px solid #777' }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, unitId: u.id, type: 'recover' });
                                    }}
                                    onMouseEnter={() => handleOOAHover(u, true)}
                                    onMouseLeave={() => handleOOAHover(u, false)}
                                    title={`${u.name}\nRight-click to Recover`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div >

            {/* Combat Modal */}
            {
                showCombatModal && combatData && (
                    <CombatModal
                        onClose={() => setShowCombatModal(false)}
                        onApply={handleCombatApply}
                        onStrategyCasualty={handleStrategyCasualty}
                        attackerUnits={combatData.attackerUnits}
                        defenderUnit={combatData.defenderUnit}
                        terrain={combatData.terrain}
                        morale={morale}
                    />
                )
            }

            {/* Context Menu */}
            {
                contextMenu && (
                    <div
                        style={{
                            position: 'fixed',
                            top: contextMenu.y,
                            left: contextMenu.x,
                            background: '#333',
                            border: '1px solid #555',
                            borderRadius: '4px',
                            padding: '5px',
                            zIndex: 1000,
                            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
                            color: 'white',
                            minWidth: '150px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {contextMenu.type === 'recover' && (
                            <button
                                onClick={() => handleRecoverUnit(contextMenu.unitId)}
                                style={{ display: 'block', width: '100%', padding: '8px', background: '#4caf50', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px' }}
                            >
                                Recover (2 Supply)
                            </button>
                        )}

                        {contextMenu.type === 'area' && (
                            <>
                                {/* Combat Initiation Check */}
                                {(() => {
                                    const areaUnits = units.filter(u => u.location === contextMenu.areaName && !['out_of_action', 'eliminated'].includes(u.status));
                                    const hasUS = areaUnits.some(u => u.faction === 'US');
                                    const hasJP = areaUnits.some(u => u.faction === 'JP');
                                    console.log(`Context Menu Check for ${contextMenu.areaName}: US=${hasUS}, JP=${hasJP}`, areaUnits);
                                    if (hasUS && hasJP) {
                                        return (
                                            <button
                                                onClick={() => {
                                                    handleCombatInitiation(contextMenu.areaName);
                                                    setContextMenu(null);
                                                }}
                                                style={{ display: 'block', width: '100%', padding: '8px', marginBottom: '5px', background: '#ff9800', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px', fontWeight: 'bold' }}
                                            >
                                                ⚔️ Resolve Combat
                                            </button>
                                        );
                                    }
                                    return null;
                                })()}

                                <button
                                    onClick={() => handleToggleControl(contextMenu.areaName)}
                                    style={{ display: 'block', width: '100%', padding: '8px', background: usControlledAreas.includes(contextMenu.areaName) ? '#d32f2f' : '#2196f3', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px' }}
                                >
                                    {usControlledAreas.includes(contextMenu.areaName) ? 'JP Recapture' : 'US Take Control'}
                                </button>
                            </>
                        )}
                        {contextMenu.type === 'unit' && (
                            <>
                                {/* Combat Initiation Check for Unit Context */}
                                {(() => {
                                    const unit = units.find(u => u.id === contextMenu.unitId);
                                    if (unit) {
                                        const areaUnits = units.filter(u => u.location === unit.location && !['out_of_action', 'eliminated'].includes(u.status));
                                        const hasUS = areaUnits.some(u => u.faction === 'US');
                                        const hasJP = areaUnits.some(u => u.faction === 'JP');

                                        if (hasUS && hasJP && currentPhase === 'Action') {
                                            return (
                                                <button
                                                    onClick={() => {
                                                        handleCombatInitiation(unit.location);
                                                        setContextMenu(null);
                                                    }}
                                                    style={{ display: 'block', width: '100%', padding: '8px', marginBottom: '5px', background: '#ff9800', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px', fontWeight: 'bold' }}
                                                >
                                                    ⚔️ Resolve Combat
                                                </button>
                                            );
                                        }
                                    }
                                    return null;
                                })()}

                                <button
                                    onClick={() => handleRemoveUnit(contextMenu.unitId)}
                                    style={{ display: 'block', width: '100%', padding: '8px', background: '#f44336', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px' }}
                                >
                                    {units.find(u => u.id === contextMenu.unitId)?.faction === 'JP' ? 'Eliminate Unit' : 'Send to Out of Action'}
                                </button>
                            </>
                        )}
                    </div>
                )
            }
        </div >
    );
}

export default App;
