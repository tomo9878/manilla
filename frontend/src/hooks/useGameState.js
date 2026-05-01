import { useState, useEffect, useRef } from 'react';
import unitsData from '../units_data.json';
import japaneseUnitsData from '../japanese_units_data.json';
import mapData from '../map_data.json';
import adjacencyData from '../adjacency.json';
import { applyCombatResult } from '../logic/combatResolution';
import { processDawnPhase, processSupplyRoll, processBloodyStreetsCheck } from '../logic/phases';
import { processRandomEvent } from '../logic/events';
import { isPointInPolygon, getCentroid, getAreaUsPosition } from '../utils/geometry';

const UNIT_SIZE = 100;

export function useGameState() {
    // ── UI / Map state ────────────────────────────────────
    const [stageSize, setStageSize] = useState({
        width: Math.floor(window.innerWidth * 0.6),
        height: window.innerHeight,
    });
    const [scale, setScale] = useState(0.25);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

    // ── Game entities ─────────────────────────────────────
    const [units, setUnits] = useState([]);
    const [selectedArea, setSelectedArea] = useState(null);
    const [usControlledAreas, setUsControlledAreas] = useState(['Area 1', 'Area 2', 'Area 30']);
    const [validRecoveryAreas, setValidRecoveryAreas] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [contestedAreas, setContestedAreas] = useState([]);

    // ── Turn / Phase ──────────────────────────────────────
    const [turn, setTurn] = useState(1);
    const [currentPhase, setCurrentPhase] = useState('Setup');
    const [currentEvent, setCurrentEvent] = useState(null);
    const [lastEvent, setLastEvent] = useState(null);
    const [bloodyStreetsQueue, setBloodyStreetsQueue] = useState([]);

    // ── Movement / Impulse ────────────────────────────────
    const [selectedUnitId, setSelectedUnitId] = useState(null);
    const [movementOptions, setMovementOptions] = useState([]);
    const [activeArea, setActiveArea] = useState(null);
    const [impulseUnits, setImpulseUnits] = useState([]);

    // ── Resources ─────────────────────────────────────────
    const [morale, setMorale] = useState(19);
    const [hasBeenShaken, setHasBeenShaken] = useState(false);
    const [supplyPoints, setSupplyPoints] = useState(12);
    const [supplyRolled, setSupplyRolled] = useState(false);
    const [supportUnits, setSupportUnits] = useState({
        artillery: { name: 'Artillery',    type: 'artillery', available: 0, used: 0, max: 11, cost: 1 },
        engineer:  { name: 'Engineer',     type: 'engineer',  available: 0, used: 0, max: 3,  cost: 2 },
        air:       { name: 'Air Support',  type: 'air',       available: 0, used: 0, max: 2,  cost: 0 },
    });

    // ── Combat modal ──────────────────────────────────────
    const [showCombatModal, setShowCombatModal] = useState(false);
    const [combatData, setCombatData] = useState(null);

    // ── Event notification modal ───────────────────────────
    const [eventNotification, setEventNotification] = useState(null);

    const fileInputRef = useRef(null);

    // ── Effects ───────────────────────────────────────────

    // Auto-start on mount — no manual Start Game needed
    useEffect(() => { handleStartGame(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (morale <= 9 && !hasBeenShaken) setHasBeenShaken(true);
    }, [morale, hasBeenShaken]);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        const handleResize = () => setStageSize({
            width: Math.floor(window.innerWidth * 0.6),
            height: window.innerHeight,
        });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setSelectedUnitId(null);
                setMovementOptions([]);
                setActiveArea(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ── Helpers ───────────────────────────────────────────

    const getUsControlledTags = () => {
        const tags = new Set();
        usControlledAreas.forEach(name => {
            const area = mapData.find(a => a.name === name);
            if (area?.terrain) tags.add(area.terrain);
        });
        return Array.from(tags);
    };

    const getDivision = (unit) => {
        const id = unit.id ?? '';
        if (id.startsWith('37_'))  return '37th';
        if (id.startsWith('1C_'))  return '1st';
        if (id.startsWith('11A_') || id.startsWith('11-')) return '11th';
        return null;
    };

    // ── Phase handlers ────────────────────────────────────

    const handleStartGame = () => {
        const newUnits = [];
        const areaCounters = {};

        unitsData.forEach(u => {
            if (!u.startArea || u.startArea === 'Reinforcements') {
                newUnits.push({ ...u, x: 0, y: 0, status: 'future' });
                return;
            }
            const area = mapData.find(a => a.name === u.startArea);
            const usPos = area ? getAreaUsPosition(area) : { x: 2800, y: 500 };
            newUnits.push({
                ...u,
                x: usPos.x - UNIT_SIZE / 2,
                y: usPos.y - UNIT_SIZE / 2,
                status: 'fresh',
                location: u.startArea,
            });
            areaCounters[u.startArea] = (areaCounters[u.startArea] ?? 0) + 1;
        });

        const pools = {
            Clear:  japaneseUnitsData.filter(u => u.terrainType === 'Clear'),
            Urban:  japaneseUnitsData.filter(u => u.terrainType === 'Urban'),
            Fort:   japaneseUnitsData.filter(u => u.terrainType === 'Fort'),
        };
        const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
        Object.values(pools).forEach(shuffle);

        const excludeKeywords = ['Turn', 'Record', 'Morale', 'Supply', 'Reinforcements', 'Chits', 'OOA', 'Elevated'];
        const excludeAreas   = ['Area 1', 'Area 2', 'Area 30'];

        mapData.forEach(area => {
            if (excludeKeywords.some(k => area.name.includes(k))) return;
            if (excludeAreas.includes(area.name)) return;
            const pool = pools[area.terrain];
            if (!pool?.length) return;
            const unit = pool.pop();
            const center = getCentroid(area.points);
            newUnits.push({
                ...unit,
                x: center.x - UNIT_SIZE / 2,
                y: center.y - UNIT_SIZE / 2,
                status: 'hidden',
                faction: 'JP',
                location: area.name,
            });
        });

        setUnits(newUnits);
        setTurn(1);
        setCurrentPhase('Dawn');
        setMorale(19);
        setSupplyPoints(12);
        setUsControlledAreas(['Area 1', 'Area 2', 'Area 30']);
        setCurrentEvent(null);
        setLastEvent(null);
    };

    const handleDawnPhase = () => {
        const data = processDawnPhase({ currentTurn: turn, units, morale });
        if (data.logs.length > 0) alert('夜明けフェーズ報告:\n' + data.logs.join('\n'));
        setUnits(data.units);
        setMorale(data.morale);
        setCurrentPhase('Event');
    };

    const handleEventPhase = () => {
        const data = processRandomEvent({
            currentTurn: turn, units, morale, lastEvent,
            usControlledTags: getUsControlledTags(),
        });
        setCurrentEvent(data.event);
        setLastEvent(data.event);
        if (data.morale !== morale) setMorale(data.morale);
        setEventNotification({ event: data.event, logs: data.logs });
    };

    const handleProceedToSupply = () => setCurrentPhase('Supply');

    const handleSupplyRoll = () => {
        const data = processSupplyRoll({ currentTurn: turn, currentSupply: supplyPoints });
        setSupplyPoints(data.new_total);
        setSupplyRolled(true);
        if (data.logs.length > 0) alert('補給結果:\n' + data.logs.join('\n'));
    };

    const handleImproveMorale = () => {
        if (supplyPoints >= 3 && morale < 19) {
            setSupplyPoints(p => p - 3);
            setMorale(p => p + 1);
        }
    };

    const handleProceedToAction = () => {
        setCurrentPhase('Action');
        setContestedAreas([]);
    };

    const handleEndTurn = () => {
        if (!window.confirm('End Action Phase and finish Turn?')) return;
        setCurrentPhase('End');
    };

    const checkBloodyStreets = () => {
        const areaData = mapData.map(area => {
            const areaUnits = units.filter(u =>
                !['out_of_action', 'eliminated', 'wounded', 'future'].includes(u.status) &&
                isPointInPolygon(u.x, u.y, area.points)
            );
            return {
                name: area.name, terrain: area.terrain,
                us_count: areaUnits.filter(u => u.faction !== 'JP').length,
                jp_count: areaUnits.filter(u => u.faction === 'JP').length,
            };
        });
        const data = processBloodyStreetsCheck({ areaData });
        if (data.results.length > 0) {
            setBloodyStreetsQueue(data.results);
            alert('⚠️ Bloody Streets detected! Resolve casualties before Combat Phase.');
        } else {
            setCurrentPhase('Combat');
        }
    };

    const handleProceedToCombat = () => {
        setSupplyRolled(false);
        checkBloodyStreets();
    };

    const handleBloodyStreetsSelection = (unitId) => {
        const event = bloodyStreetsQueue[0];
        if (!event) return;
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        if (unit.faction === 'JP') { alert('Must select a US unit for casualties.'); return; }
        const area = mapData.find(a => a.name === event.area);
        if (!area || !isPointInPolygon(unit.x, unit.y, area.points)) {
            alert(`Selected unit must be in ${event.area}!`); return;
        }
        if (event.morale_penalty > 0) setMorale(p => p - event.morale_penalty);
        setUnits(prev => prev.map(u => u.id === unitId ? { ...u, status: 'out_of_action' } : u));
        const newQueue = bloodyStreetsQueue.slice(1);
        setBloodyStreetsQueue(newQueue);
        if (newQueue.length === 0) {
            alert('Bloody Streets resolution complete. Beginning Combat Phase.');
            setCurrentPhase('Combat');
        }
    };

    const handleEndPhase = () => {
        setUnits(units.map(u => ({ ...u, status: 'fresh' })));
        setSupportUnits(prev => {
            const next = {};
            Object.keys(prev).forEach(k => { next[k] = { ...prev[k], used: 0 }; });
            return next;
        });
        setTurn(p => p + 1);
        setCurrentPhase('Dawn');
        setCurrentEvent(null);
    };

    // ── Combat handlers ───────────────────────────────────

    const handleUnitReveal = (unitId) => {
        setUnits(prev => prev.map(u => u.id === unitId ? { ...u, status: 'revealed' } : u));
    };

    const handleCombatInitiation = (areaName) => {
        if (activeArea && activeArea !== areaName) {
            const adj = adjacencyData[activeArea] ?? [];
            if (!adj.includes(areaName)) {
                alert(`Impulse active for ${activeArea}. Finish current impulse first.`); return;
            }
        }
        const areaUnits = units.filter(u => u.location === areaName && !['eliminated', 'out_of_action'].includes(u.status));
        const attackers = areaUnits.filter(u => u.faction === 'US');
        const defenders = areaUnits.filter(u => u.faction === 'JP');
        if (!attackers.length || !defenders.length) return;

        const area = mapData.find(a => a.name === areaName);
        const defender = defenders[0];
        setCombatData({
            attackerUnits: attackers.map(u => ({
                ...u,
                attack_factor: u.attack_factor ?? u.attack ?? 0,
            })),
            defenderUnit: {
                ...defender,
                strength: defender.defense_factor ?? defender.strength ?? 3,
                unitClass: defender.unitClass ?? 'Infantry',
            },
            terrain: area?.terrain ?? 'Clear',
            areaName,
        });
        setShowCombatModal(true);
    };

    const handleCombatApply = (result) => {
        const data = applyCombatResult({
            resultType:          result.resultType,
            attackerUnits:       result.attackerUnits ?? [],
            defenderUnit:        result.defenderUnit ?? null,
            targetArea:          combatData.areaName,
            currentMorale:       morale,
            strategyCasualtyIds: result.strategyCasualtyIds ?? [],
        });

        const updatedIds = new Set();
        const updates = {};
        data.updated_attacker_units?.forEach(u => { updatedIds.add(u.id); updates[u.id] = u; });
        if (data.updated_defender_unit) {
            updatedIds.add(data.updated_defender_unit.id);
            updates[data.updated_defender_unit.id] = data.updated_defender_unit;
        }
        if (data.new_morale !== undefined) setMorale(data.new_morale);
        if (data.area_update?.control === 'US') {
            setUsControlledAreas(prev => Array.from(new Set([...prev, combatData.areaName])));
        }
        setUnits(prev => prev.map(u => updatedIds.has(u.id) ? { ...u, ...updates[u.id] } : u));

        // Consume support units used in this combat
        const s = result.supportUsed;
        if (s) {
            setSupportUnits(prev => ({
                ...prev,
                artillery: { ...prev.artillery,
                    available: Math.max(0, prev.artillery.available - (s.artillery ?? 0)),
                    used:      prev.artillery.used + (s.artillery ?? 0) },
                engineer:  { ...prev.engineer,
                    available: Math.max(0, prev.engineer.available - (s.engineer ?? 0)),
                    used:      prev.engineer.used + (s.engineer ?? 0) },
                air:       { ...prev.air,
                    available: Math.max(0, prev.air.available - (s.air_support ? 1 : 0)),
                    used:      prev.air.used + (s.air_support ? 1 : 0) },
            }));
        }

        if (result.isOverrun || result.is_overrun) alert('突破！攻撃部隊は消耗せず行動継続可能。');
        setShowCombatModal(false);
        setCombatData(null);
    };

    const handleStrategyCasualty = (casualtyIds) => {
        setUnits(prev => prev.map(u => casualtyIds.includes(u.id) ? { ...u, status: 'out_of_action' } : u));
    };

    // ── Unit handlers ─────────────────────────────────────

    const handleUnitClick = (id) => {
        if (bloodyStreetsQueue.length > 0) { handleBloodyStreetsSelection(id); return; }
        const unit = units.find(u => u.id === id);
        if (!unit) return;

        if (currentPhase === 'Action' && unit.faction === 'US' && unit.status === 'fresh') {
            if (activeArea && activeArea !== unit.location) {
                if (window.confirm(`Finish impulse for ${activeArea} and switch to ${unit.location}?`)) {
                    handleImpulseCommit();
                } else return;
            }
            if (!activeArea) setActiveArea(unit.location);
            if (selectedUnitId === id) { setSelectedUnitId(null); setMovementOptions([]); return; }
            setSelectedUnitId(id);
            const adjacent = adjacencyData[unit.location] ?? [];
            const valid = adjacent.filter(name => {
                const count = units.filter(u => u.faction === 'US' && u.location === name && !['out_of_action', 'eliminated'].includes(u.status)).length;
                return count < 6;
            });
            setMovementOptions(valid);
        }
    };

    const handleUnitDblClick = (id) => {
        setUnits(units.map(u => u.id === id ? { ...u, status: u.status === 'fresh' ? 'spent' : 'fresh' } : u));
    };

    const applyUnitMove = (id, newX, newY) => {
        // Check both the top-left corner and center of the unit to find the area
        const cx = newX + UNIT_SIZE / 2, cy = newY + UNIT_SIZE / 2;
        const area = mapData.find(a => isPointInPolygon(cx, cy, a.points))
                  ?? mapData.find(a => isPointInPolygon(newX, newY, a.points));
        const locationName = area?.name ?? 'Unknown';
        setUnits(prev => {
            const next = prev.map(u => u.id === id ? { ...u, x: newX, y: newY, location: locationName } : u);
            if (currentPhase === 'Action') {
                const hasJP = next.some(u => u.faction === 'JP' && !['out_of_action', 'eliminated'].includes(u.status) && u.location === locationName);
                if (hasJP) setContestedAreas(p => p.includes(locationName) ? p : [...p, locationName]);
            }
            return next;
        });
    };

    const handleDeselect = () => {
        setSelectedUnitId(null);
        setMovementOptions([]);
        setActiveArea(null);
    };

    const handleMoveSelect = (targetAreaName) => {
        if (!selectedUnitId) return;
        const area = mapData.find(a => a.name === targetAreaName);
        if (!area) return;
        const usPos = getAreaUsPosition(area);
        applyUnitMove(selectedUnitId, usPos.x - UNIT_SIZE / 2, usPos.y - UNIT_SIZE / 2);
        setSelectedUnitId(null);
        setMovementOptions([]);
        setActiveArea(null);
    };

    const handleUnitContextMenu = (e, unitId) => {
        setContextMenu({ x: e.clientX, y: e.clientY, unitId, type: 'unit' });
    };

    const handleRecoverUnit = (unitId) => {
        if (supplyPoints < 2) { alert('Not enough supply options!'); return; }
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        const area = mapData.find(a => a.name === unit.startArea);
        const usPos = area ? getAreaUsPosition(area) : { x: 100, y: 100 };
        setSupplyPoints(p => p - 2);
        setUnits(prev => prev.map(u => u.id === unitId ? { ...u, status: 'fresh', x: usPos.x - UNIT_SIZE / 2, y: usPos.y - UNIT_SIZE / 2 } : u));
        setContextMenu(null);
    };

    const handleRemoveUnit = (unitId) => {
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        if (unit.faction === 'JP') { setUnits(prev => prev.filter(u => u.id !== unitId)); }
        else { setUnits(prev => prev.map(u => u.id === unitId ? { ...u, status: 'out_of_action' } : u)); }
        setContextMenu(null);
    };

    const handleImpulseCommit = () => {
        setUnits(prev => prev.map(u => impulseUnits.includes(u.id) ? { ...u, status: 'spent' } : u));
        setActiveArea(null);
        setImpulseUnits([]);
        setSelectedUnitId(null);
        setMovementOptions([]);
    };

    // ── Area handlers ─────────────────────────────────────

    const handleToggleControl = (areaName) => {
        setUsControlledAreas(prev =>
            prev.includes(areaName) ? prev.filter(n => n !== areaName) : [...prev, areaName]
        );
        setContextMenu(null);
    };

    const handleAreaContextMenu = (e, areaName) => {
        e.cancelBubble = true;
        e.evt.preventDefault();
        setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, areaName, type: 'area' });
    };

    // ── Support handlers ──────────────────────────────────

    const handleBuySupport = (type) => {
        if (currentPhase !== 'Supply') return;
        if (type === 'air' && !hasBeenShaken) { alert('Air Support is locked until US Morale drops to 9.'); return; }
        const unit = supportUnits[type];
        if (!unit || supplyPoints < unit.cost || (unit.available + unit.used) >= unit.max) return;
        setSupplyPoints(p => p - unit.cost);
        setSupportUnits(prev => ({ ...prev, [type]: { ...prev[type], available: prev[type].available + 1 } }));
    };

    // ── Map / Stage handlers ──────────────────────────────

    const handleImageLoad = (size) => {
        setMapSize(size);
        if (size.width > 0 && size.height > 0) {
            const stageW = Math.floor(window.innerWidth * 0.6);
            const newScale = Math.min(stageW / size.width, window.innerHeight / size.height) * 0.9;
            setScale(newScale);
            setPosition({
                x: (stageW - size.width * newScale) / 2,
                y: (window.innerHeight - size.height * newScale) / 2,
            });
        }
    };

    const handleWheel = (e) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const pointer = e.target.getStage().getPointerPosition();
        const mousePointTo = { x: (pointer.x - position.x) / scale, y: (pointer.y - position.y) / scale };
        const newScale = e.evt.deltaY < 0 ? scale * scaleBy : scale / scaleBy;
        setScale(newScale);
        setPosition({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    };

    const handleOOAHover = (unit, isHovering) => {
        if (!isHovering) { setValidRecoveryAreas([]); return; }
        const division = getDivision(unit);
        const validSet = new Set();
        if (unit.startArea && usControlledAreas.includes(unit.startArea)) validSet.add(unit.startArea);
        if (division) {
            const friendlies = units.filter(u =>
                !['out_of_action', 'eliminated', 'wounded'].includes(u.status) && getDivision(u) === division
            );
            usControlledAreas.forEach(areaName => {
                const area = mapData.find(a => a.name === areaName);
                if (area && friendlies.some(u => isPointInPolygon(u.x, u.y, area.points))) validSet.add(areaName);
            });
        }
        setValidRecoveryAreas(Array.from(validSet));
    };

    // ── Save / Load ───────────────────────────────────────

    const handleSaveGame = () => {
        const state = { turn, currentPhase, morale, supplyRolled, hasBeenShaken, usControlledAreas, units, supportUnits, currentEvent, lastEvent, contestedAreas, bloodyStreetsQueue, timestamp: new Date().toISOString() };
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })),
            download: `manila_save_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
        });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const handleLoadGame = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const s = JSON.parse(e.target.result);
                if (s.turn !== undefined)              setTurn(s.turn);
                if (s.currentPhase !== undefined)      setCurrentPhase(s.currentPhase);
                if (s.morale !== undefined)            setMorale(s.morale);
                if (s.supplyRolled !== undefined)      setSupplyRolled(s.supplyRolled);
                if (s.hasBeenShaken !== undefined)     setHasBeenShaken(s.hasBeenShaken);
                if (s.usControlledAreas)               setUsControlledAreas(s.usControlledAreas);
                if (s.units)                           setUnits(s.units);
                if (s.supportUnits)                    setSupportUnits(s.supportUnits);
                if (s.currentEvent !== undefined)      setCurrentEvent(s.currentEvent);
                if (s.lastEvent !== undefined)         setLastEvent(s.lastEvent);
                if (s.contestedAreas)                  setContestedAreas(s.contestedAreas);
                if (s.bloodyStreetsQueue)               setBloodyStreetsQueue(s.bloodyStreetsQueue);
                alert('ゲームをロードしました！');
            } catch { alert('セーブデータの読み込みに失敗しました。'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    // ── Stack render data ─────────────────────────────────

    const sortedUnits = units
        .filter(u => !['out_of_action', 'eliminated', 'wounded', 'future'].includes(u.status))
        .sort((a, b) => a.y - b.y || a.x - b.x);

    return {
        // state
        stageSize, scale, position, setPosition, setScale,
        units, setUnits,
        selectedArea, setSelectedArea,
        usControlledAreas, validRecoveryAreas,
        contextMenu, setContextMenu,
        contestedAreas,
        turn, currentPhase,
        currentEvent, lastEvent,
        bloodyStreetsQueue,
        selectedUnitId, movementOptions,
        morale, supplyPoints, supplyRolled, hasBeenShaken, supportUnits,
        showCombatModal, setShowCombatModal,
        combatData,
        eventNotification, setEventNotification,
        fileInputRef,
        sortedUnits,
        // handlers
        handleStartGame,
        handleDawnPhase, handleEventPhase, handleProceedToSupply,
        handleSupplyRoll, handleImproveMorale, handleProceedToAction,
        handleEndTurn, handleProceedToCombat, handleBloodyStreetsSelection,
        handleEndPhase,
        handleUnitReveal, handleCombatInitiation, handleCombatApply, handleStrategyCasualty,
        handleUnitClick, handleUnitDblClick, handleDeselect,
        handleMoveSelect, handleUnitContextMenu,
        handleRecoverUnit, handleRemoveUnit, handleImpulseCommit,
        handleToggleControl, handleAreaContextMenu,
        handleBuySupport,
        handleImageLoad, handleWheel, handleOOAHover,
        handleSaveGame, handleLoadGame,
        // data refs
        mapData, adjacencyData,
    };
}
