import { Stage, Layer, Line, Text, Group, Rect, Circle } from 'react-konva';
import Konva from 'konva';
import { useGameState } from './hooks/useGameState';
import { isPointInPolygon, getCentroid } from './utils/geometry';
import mapData from './map_data.json';
import adjacencyData from './adjacency.json';
import UnitCounter from './components/UnitCounter';
import MapImage from './components/MapImage';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import CombatModal from './components/CombatModal';

const BASE = import.meta.env.BASE_URL;
Konva.pixelRatio = window.devicePixelRatio || 1;

const STACK_THRESHOLD = 40;

function App() {
    const gs = useGameState();

    // Stack index map for render order (O(N²) but N≈50)
    const stackMap = {};
    gs.sortedUnits.forEach(u => {
        stackMap[u.id] = gs.sortedUnits.filter(o =>
            o.id !== u.id &&
            Math.abs(o.x - u.x) < STACK_THRESHOLD &&
            Math.abs(o.y - u.y) < STACK_THRESHOLD &&
            o.id < u.id
        ).length;
    });

    return (
        <div onContextMenu={e => e.preventDefault()} style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: '#222' }}>

            <LeftPanel
                selectedArea={gs.selectedArea}
                adjacencyData={adjacencyData}
                units={gs.units}
                currentPhase={gs.currentPhase}
                currentEvent={gs.currentEvent}
                handleStartGame={gs.handleStartGame}
                handleDawnPhase={gs.handleDawnPhase}
                handleEventPhase={gs.handleEventPhase}
                handleProceedToSupply={gs.handleProceedToSupply}
                handleEndPhase={gs.handleEndPhase}
                handleSaveGame={gs.handleSaveGame}
                handleLoadGame={gs.handleLoadGame}
                fileInputRef={gs.fileInputRef}
            />

            {/* CENTER PANEL */}
            <div style={{ flex: '0 0 60%', position: 'relative', background: '#333', overflow: 'hidden' }}>

                {/* Hovered stack tooltip */}
                {gs.hoveredStack && (
                    <div style={{
                        position: 'absolute',
                        top: gs.hoveredStack.pointer.y + 20,
                        left: gs.hoveredStack.pointer.x + 20,
                        zIndex: 100, pointerEvents: 'none',
                        background: 'rgba(0,0,0,0.85)',
                        padding: '8px', borderRadius: '6px', border: '1px solid #999',
                        display: 'flex', flexDirection: 'row', gap: '8px',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
                    }}>
                        {gs.hoveredStack.units.map(stackUnit => {
                            const u = gs.units.find(live => live.id === stackUnit.id) || stackUnit;
                            if (['out_of_action', 'eliminated', 'future'].includes(u.status)) return null;
                            return (
                                <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <img
                                        src={`${BASE}images/${((u.status === 'spent' || u.status === 'revealed') && u.backImage) ? u.backImage : u.frontImage}`}
                                        alt={u.id}
                                        style={{ width: '100px', height: '100px', borderRadius: '4px' }}
                                    />
                                    <div style={{ color: '#eee', fontSize: '0.75rem', marginTop: '4px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {u.status === 'hidden' ? 'Hidden' : u.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Bloody Streets banner */}
                {gs.bloodyStreetsQueue.length > 0 && (
                    <div style={{
                        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 500, background: 'rgba(50,0,0,0.95)', color: 'white',
                        padding: '20px', borderRadius: '8px', border: '2px solid red',
                        boxShadow: '0 0 20px rgba(255,0,0,0.5)', textAlign: 'center', maxWidth: '80%',
                    }}>
                        <h2 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #fff', color: '#ff3333' }}>BLOODY STREETS!</h2>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Area: {gs.bloodyStreetsQueue[0].area}</div>
                        <div style={{ margin: '10px 0', fontSize: '1rem' }}>
                            Result: Rolled {gs.bloodyStreetsQueue[0].roll} ({gs.bloodyStreetsQueue[0].effect})
                        </div>
                        <div style={{ color: '#ffaaaa', fontWeight: 'bold' }}>
                            ⚠ Select 1 US Unit in this area to take casualties (OOA).
                        </div>
                        {gs.bloodyStreetsQueue[0].morale_penalty > 0 && (
                            <div style={{ color: '#fa0', fontSize: '0.9rem', marginTop: '5px' }}>
                                (Additional Consequence: Morale -{gs.bloodyStreetsQueue[0].morale_penalty})
                            </div>
                        )}
                    </div>
                )}

                <Stage
                    width={gs.stageSize.width}
                    height={gs.stageSize.height}
                    draggable
                    onWheel={gs.handleWheel}
                    scaleX={gs.scale}
                    scaleY={gs.scale}
                    x={gs.position.x}
                    y={gs.position.y}
                    onDragEnd={e => {
                        if (e.target === e.target.getStage()) {
                            gs.setPosition({ x: e.target.x(), y: e.target.y() });
                        }
                    }}
                >
                    <Layer imageSmoothingEnabled={false}>
                        <Rect x={-5000} y={-5000} width={10000} height={10000} fill="#333" />

                        <MapImage onImageLoad={gs.handleImageLoad} />

                        {/* Contested area icons */}
                        {gs.contestedAreas.map(areaName => {
                            const area = mapData.find(a => a.name === areaName);
                            if (!area) return null;
                            const center = getCentroid(area.points);
                            return (
                                <Text
                                    key={`combat-${areaName}`}
                                    x={center.x - 20} y={center.y - 20}
                                    text="⚔️" fontSize={40}
                                    onClick={() => gs.handleCombatInitiation(areaName)}
                                    onTap={() => gs.handleCombatInitiation(areaName)}
                                    listening={gs.currentPhase === 'Action'}
                                />
                            );
                        })}

                        {/* Area polygons */}
                        {mapData.map((area, i) => {
                            let fill = 'rgba(0,0,0,0)';
                            let stroke = 'rgba(255,255,255,0.3)';
                            let strokeWidth = 2;

                            if (gs.usControlledAreas.includes(area.name)) fill = 'rgba(33,150,243,0.2)';
                            if (gs.selectedArea?.name === area.name) { fill = 'rgba(255,255,0,0.3)'; stroke = 'yellow'; strokeWidth = 5; }
                            if (gs.movementOptions.includes(area.name)) { fill = 'rgba(0,255,0,0.4)'; stroke = '#00ff00'; strokeWidth = 4; }
                            if (gs.validRecoveryAreas.includes(area.name)) { fill = 'rgba(0,100,255,0.3)'; stroke = 'cyan'; }
                            if (gs.contestedAreas.includes(area.name)) { stroke = 'red'; strokeWidth = 4; }

                            return (
                                <Line
                                    key={i}
                                    points={area.points}
                                    fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                                    closed
                                    onMouseEnter={() => { document.body.style.cursor = 'pointer'; }}
                                    onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                                    onClick={e => {
                                        gs.setSelectedArea(area);
                                        if (e.evt.button === 2) { gs.handleAreaContextMenu(e, area.name); return; }
                                        if (gs.selectedUnitId && gs.movementOptions.includes(area.name)) {
                                            gs.handleMoveSelect(area.name);
                                        } else if (gs.currentPhase === 'Combat') {
                                            gs.handleCombatInitiation(area.name);
                                        }
                                    }}
                                    listening
                                />
                            );
                        })}

                        {/* Units */}
                        {gs.sortedUnits.map(unit => (
                            <UnitCounter
                                key={unit.id}
                                unit={unit}
                                x={unit.x} y={unit.y}
                                isSelected={unit.id === gs.selectedUnitId}
                                onDragStart={gs.handleUnitDragStart}
                                onDragEnd={gs.handleUnitDragEnd}
                                onClick={gs.handleUnitClick}
                                onDblClick={gs.handleUnitDblClick}
                                onHover={gs.handleUnitHover}
                                onContextMenu={gs.handleUnitContextMenu}
                            />
                        ))}

                        {/* Movement option circles */}
                        {gs.movementOptions.map(areaName => {
                            const area = mapData.find(a => a.name === areaName);
                            if (!area) return null;
                            const center = getCentroid(area.points);
                            return (
                                <Group
                                    key={`move-${areaName}`}
                                    onClick={() => gs.handleMoveSelect(areaName)}
                                    onTap={() => gs.handleMoveSelect(areaName)}
                                    onMouseEnter={() => { document.body.style.cursor = 'pointer'; }}
                                    onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                                >
                                    <Circle x={center.x} y={center.y} radius={30} fill="rgba(0,255,0,0.4)" stroke="lime" strokeWidth={2} />
                                    <Text x={center.x - 20} y={center.y - 6} text="MOVE" fontSize={12} fill="white" fontStyle="bold" width={40} align="center" listening={false} />
                                </Group>
                            );
                        })}
                    </Layer>
                </Stage>
            </div>

            <RightPanel
                turn={gs.turn}
                currentPhase={gs.currentPhase}
                morale={gs.morale}
                supplyPoints={gs.supplyPoints}
                supplyRolled={gs.supplyRolled}
                hasBeenShaken={gs.hasBeenShaken}
                usControlledAreas={gs.usControlledAreas}
                supportUnits={gs.supportUnits}
                units={gs.units}
                setContextMenu={gs.setContextMenu}
                handleSupplyRoll={gs.handleSupplyRoll}
                handleImproveMorale={gs.handleImproveMorale}
                handleProceedToAction={gs.handleProceedToAction}
                handleEndTurn={gs.handleEndTurn}
                handleBuySupport={gs.handleBuySupport}
                handleOOAHover={gs.handleOOAHover}
            />

            {/* Combat Modal */}
            {gs.showCombatModal && gs.combatData && (
                <CombatModal
                    onClose={() => gs.setShowCombatModal(false)}
                    onApply={gs.handleCombatApply}
                    onReveal={gs.handleUnitReveal}
                    onStrategyCasualty={gs.handleStrategyCasualty}
                    attackerUnits={gs.combatData.attackerUnits}
                    defenderUnit={gs.combatData.defenderUnit}
                    terrain={gs.combatData.terrain}
                    morale={gs.morale}
                />
            )}

            {/* Context Menu */}
            {gs.contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: gs.contextMenu.y, left: gs.contextMenu.x,
                        background: '#333', border: '1px solid #555', borderRadius: '4px',
                        padding: '5px', zIndex: 1000,
                        boxShadow: '0 4px 8px rgba(0,0,0,0.5)', color: 'white', minWidth: '150px',
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {gs.contextMenu.type === 'recover' && (
                        <button
                            onClick={() => gs.handleRecoverUnit(gs.contextMenu.unitId)}
                            style={{ display: 'block', width: '100%', padding: '8px', background: '#4caf50', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px' }}
                        >
                            Recover (補給 2)
                        </button>
                    )}

                    {gs.contextMenu.type === 'area' && (() => {
                        const areaUnits = gs.units.filter(u => u.location === gs.contextMenu.areaName && !['out_of_action', 'eliminated'].includes(u.status));
                        const hasUS = areaUnits.some(u => u.faction === 'US');
                        const hasJP = areaUnits.some(u => u.faction === 'JP');
                        return (
                            <>
                                {hasUS && hasJP && (
                                    <button
                                        onClick={() => { gs.handleCombatInitiation(gs.contextMenu.areaName); gs.setContextMenu(null); }}
                                        style={{ display: 'block', width: '100%', padding: '8px', marginBottom: '5px', background: '#ff9800', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px', fontWeight: 'bold' }}
                                    >
                                        ⚔️ 戦闘解決
                                    </button>
                                )}
                                <button
                                    onClick={() => gs.handleToggleControl(gs.contextMenu.areaName)}
                                    style={{ display: 'block', width: '100%', padding: '8px', background: gs.usControlledAreas.includes(gs.contextMenu.areaName) ? '#d32f2f' : '#2196f3', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px' }}
                                >
                                    {gs.usControlledAreas.includes(gs.contextMenu.areaName) ? '日本軍支配へ' : '米軍支配へ'}
                                </button>
                            </>
                        );
                    })()}

                    {gs.contextMenu.type === 'unit' && (() => {
                        const unit = gs.units.find(u => u.id === gs.contextMenu.unitId);
                        if (!unit) return null;
                        const areaUnits = gs.units.filter(u => u.location === unit.location && !['out_of_action', 'eliminated'].includes(u.status));
                        const hasUS = areaUnits.some(u => u.faction === 'US');
                        const hasJP = areaUnits.some(u => u.faction === 'JP');
                        return (
                            <>
                                {hasUS && hasJP && gs.currentPhase === 'Action' && (
                                    <button
                                        onClick={() => { gs.handleCombatInitiation(unit.location); gs.setContextMenu(null); }}
                                        style={{ display: 'block', width: '100%', padding: '8px', marginBottom: '5px', background: '#ff9800', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px', fontWeight: 'bold' }}
                                    >
                                        ⚔️ 戦闘解決
                                    </button>
                                )}
                                <button
                                    onClick={() => gs.handleRemoveUnit(gs.contextMenu.unitId)}
                                    style={{ display: 'block', width: '100%', padding: '8px', background: '#f44336', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '2px' }}
                                >
                                    {unit.faction === 'JP' ? '部隊除去' : '戦線離脱 (OOA) へ'}
                                </button>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

export default App;
