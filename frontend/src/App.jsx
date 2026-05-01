import { Stage, Layer, Line, Text, Group, Rect } from 'react-konva';
import Konva from 'konva';
import { useGameState } from './hooks/useGameState';
import { useState } from 'react';
import { isPointInPolygon, getCentroid } from './utils/geometry';
import mapData from './map_data.json';
import adjacencyData from './adjacency.json';
import UnitCounter from './components/UnitCounter';
import MapImage from './components/MapImage';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import CombatModal from './components/CombatModal';
import { unitLabel } from './logic/unitNames';

const BASE = import.meta.env.BASE_URL;
Konva.pixelRatio = window.devicePixelRatio || 1;


function App() {
    const gs = useGameState();
    const [recoveryTarget, setRecoveryTarget] = useState(null);

    // Per-area stack index for US units: units in the same location get offset
    const usStackByLoc = {};
    gs.sortedUnits.forEach(u => {
        if (u.faction !== 'US') return;
        if (!usStackByLoc[u.location]) usStackByLoc[u.location] = [];
        usStackByLoc[u.location].push(u.id);
    });
    const usStackIdx = {};
    Object.values(usStackByLoc).forEach(ids => {
        ids.forEach((id, i) => { usStackIdx[id] = i; });
    });

    return (
        <div onContextMenu={e => e.preventDefault()} style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: '#222' }}>

            <LeftPanel
                selectedArea={gs.selectedArea}
                adjacencyData={adjacencyData}
                units={gs.units}
                currentPhase={gs.currentPhase}
                currentEvent={gs.currentEvent}
                selectedUnitId={gs.selectedUnitId}
                handleUnitClick={gs.handleUnitClick}
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
                        <Rect x={-5000} y={-5000} width={10000} height={10000} fill="#333" onClick={gs.handleDeselect} />

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
                                        } else if (gs.selectedUnitId) {
                                            gs.handleDeselect();
                                        }
                                    }}
                                    listening
                                />
                            );
                        })}

                        {/* Units */}
                        {gs.sortedUnits.map(unit => {
                            const si = unit.faction === 'US' ? (usStackIdx[unit.id] ?? 0) : 0;
                            return (
                                <UnitCounter
                                    key={unit.id}
                                    unit={unit}
                                    x={unit.x + si * 8}
                                    y={unit.y - si * 8}
                                    isSelected={unit.id === gs.selectedUnitId}
                                    onClick={gs.handleUnitClick}
                                    onDblClick={gs.handleUnitDblClick}
                                    onContextMenu={gs.handleUnitContextMenu}
                                />
                            );
                        })}

                        {/* Movement destination buttons */}
                        {gs.movementOptions.map(areaName => {
                            const area = mapData.find(a => a.name === areaName);
                            if (!area) return null;
                            const center = getCentroid(area.points);
                            const btnW = 110;
                            const btnH = 32;
                            return (
                                <Group
                                    key={`move-${areaName}`}
                                    onClick={() => gs.handleMoveSelect(areaName)}
                                    onTap={() => gs.handleMoveSelect(areaName)}
                                    onMouseEnter={() => { document.body.style.cursor = 'pointer'; }}
                                    onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                                >
                                    <Rect
                                        x={center.x - btnW / 2} y={center.y - btnH / 2}
                                        width={btnW} height={btnH}
                                        fill="rgba(0,180,0,0.85)" stroke="lime" strokeWidth={2}
                                        cornerRadius={4}
                                    />
                                    <Text
                                        x={center.x - btnW / 2} y={center.y - 8}
                                        text={areaName} fontSize={14}
                                        fill="white" fontStyle="bold"
                                        width={btnW} align="center"
                                        listening={false}
                                    />
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

            {/* Supply Recovery Modal */}
            {gs.currentPhase === 'Supply' && (() => {
                const ooa = gs.units.filter(u => u.faction === 'US' && u.status === 'out_of_action');
                if (ooa.length === 0) return null;
                const target = recoveryTarget ? gs.units.find(u => u.id === recoveryTarget) : null;
                const validAreas = target ? gs.getRecoveryAreas(target) : [];
                return (
                    <div style={{ position: 'fixed', top: '80px', right: '320px', background: '#1e1e1e', border: '1px solid #555', borderRadius: '8px', padding: '1rem', zIndex: 500, minWidth: '260px', color: '#eee', maxHeight: '60vh', overflowY: 'auto' }}>
                        <div style={{ fontWeight: 'bold', color: '#ffcc00', marginBottom: '0.75rem' }}>OOA部隊の回復</div>
                        <div style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '0.75rem' }}>補給ポイント残: {gs.supplyPoints}</div>
                        {ooa.map(u => {
                            const cost = gs.getRecoveryCost(u);
                            const isSelected = recoveryTarget === u.id;
                            const canAfford = gs.supplyPoints >= cost;
                            return (
                                <div key={u.id} style={{ marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: isSelected ? '#1a3a6a' : '#2a2a2a', borderRadius: '4px', border: `1px solid ${isSelected ? '#ffcc00' : '#444'}` }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', color: '#8bf' }}>{unitLabel(u)}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#888' }}>{u.type} — {cost}pt</div>
                                        </div>
                                        <button
                                            onClick={() => setRecoveryTarget(isSelected ? null : u.id)}
                                            disabled={!canAfford}
                                            style={{ padding: '4px 10px', background: canAfford ? (isSelected ? '#ffcc00' : '#1a4a2a') : '#333', color: canAfford ? (isSelected ? '#000' : '#4f4') : '#666', border: 'none', borderRadius: '3px', cursor: canAfford ? 'pointer' : 'default', fontSize: '0.8rem' }}
                                        >
                                            {isSelected ? 'キャンセル' : '回復'}
                                        </button>
                                    </div>
                                    {isSelected && (
                                        <div style={{ padding: '6px 8px', background: '#111', borderRadius: '0 0 4px 4px', border: '1px solid #ffcc00', borderTop: 'none' }}>
                                            <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>配置先:</div>
                                            {validAreas.length > 0 ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {validAreas.map(area => (
                                                        <button
                                                            key={area}
                                                            onClick={() => { gs.handleRecoverUnit(u.id, area); setRecoveryTarget(null); }}
                                                            style={{ padding: '4px 10px', background: '#1a4a7a', color: 'white', border: '1px solid #4a8aaa', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                        >
                                                            {area}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ color: '#f88', fontSize: '0.75rem' }}>配置可能エリアなし</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Deployment Modal */}
            {gs.currentPhase === 'Deployment' && gs.deploymentUnits.length > 0 && (() => {
                const unit = gs.deploymentUnits[0];
                const remaining = gs.deploymentUnits.length;
                const availableAreas = gs.DEPLOYMENT_AREAS.filter(a => gs.usControlledAreas.includes(a));
                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ background: '#1e1e1e', border: '2px solid #ffcc00', borderRadius: '8px', padding: '2rem', minWidth: '360px', color: '#eee' }}>
                            <h2 style={{ margin: '0 0 0.5rem', color: '#ffcc00' }}>増援配置</h2>
                            <div style={{ color: '#aaa', marginBottom: '1.5rem', fontSize: '0.85rem' }}>残り {remaining} 部隊</div>

                            <div style={{ background: '#2a2a2a', borderRadius: '4px', padding: '1rem', marginBottom: '1.5rem', border: '1px solid #444' }}>
                                <div style={{ color: '#8bf', fontWeight: 'bold', marginBottom: '4px' }}>
                                    {unit.name}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.8rem' }}>{unit.type} | AF{unit.attack_factor} DF{unit.defense_factor}</div>
                            </div>

                            <div style={{ marginBottom: '1rem', color: '#aaa', fontSize: '0.85rem' }}>配置先を選択:</div>
                            {availableAreas.length > 0 ? (
                                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                    {availableAreas.map(area => (
                                        <button
                                            key={area}
                                            onClick={() => gs.handleDeployUnit(unit.id, area)}
                                            style={{ padding: '12px', background: '#1a4a7a', color: 'white', border: '1px solid #4a8aaa', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                                        >
                                            {area}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ color: '#f88', padding: '1rem', background: '#2a1a1a', borderRadius: '4px' }}>
                                    利用可能な配置エリアがありません（Area 27/28/30 が米軍支配下にない）
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

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
                    supportUnits={gs.supportUnits}
                />
            )}

            {/* Event Notification Modal */}
            {gs.eventNotification && (() => {
                const { event, logs } = gs.eventNotification;
                const TYPE_COLOR = {
                    'Japanese Attack':           '#c0392b',
                    'Japanese Offensive':        '#e67e22',
                    'Pause':                     '#2980b9',
                    'Mandatory Attack Priority': '#8e44ad',
                    'No Result':                 '#555',
                };
                const accentColor = TYPE_COLOR[event.type] ?? '#555';
                return (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 2000,
                        background: 'rgba(0,0,0,0.75)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            background: '#1a1a1a', border: `2px solid ${accentColor}`,
                            borderRadius: '10px', padding: '28px 32px', maxWidth: '480px', width: '90%',
                            boxShadow: `0 0 30px ${accentColor}66`, color: '#eee',
                        }}>
                            {/* header */}
                            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px', letterSpacing: '0.08em' }}>
                                ランダムイベント・フェーズ
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: accentColor, marginBottom: '12px', borderBottom: `1px solid ${accentColor}55`, paddingBottom: '8px' }}>
                                {event.ja_name}
                            </div>

                            {/* dice */}
                            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '14px' }}>
                                ダイス: {event.rolls?.join(' + ')} = <strong style={{ color: '#fff' }}>{event.roll}</strong>
                            </div>

                            {/* effect description */}
                            <div style={{
                                background: '#2a2a2a', borderRadius: '6px', padding: '12px 14px',
                                borderLeft: `3px solid ${accentColor}`, marginBottom: '14px',
                                fontSize: '0.9rem', lineHeight: '1.6',
                            }}>
                                <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>効果</div>
                                {event.effect_desc}
                            </div>

                            {/* morale change */}
                            {event.moraleChange < 0 && (
                                <div style={{ color: '#e74c3c', fontWeight: 'bold', marginBottom: '12px', fontSize: '0.95rem' }}>
                                    ⚠ 士気変動: {event.moraleChange} (現在 {gs.morale})
                                </div>
                            )}

                            {/* log */}
                            <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.78rem', color: '#777', marginBottom: '18px', fontFamily: 'monospace' }}>
                                {logs.map((l, i) => <div key={i}>{l}</div>)}
                            </div>

                            <button
                                onClick={() => gs.setEventNotification(null)}
                                style={{
                                    width: '100%', padding: '10px', background: accentColor,
                                    color: 'white', border: 'none', borderRadius: '6px',
                                    cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem',
                                }}
                            >
                                了解
                            </button>
                        </div>
                    </div>
                );
            })()}

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
