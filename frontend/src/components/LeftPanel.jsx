import { useState } from 'react';
import { getUnitNameJa, getDivisionJa, unitLabel } from '../logic/unitNames';

const BASE = import.meta.env.BASE_URL;

const LeftPanel = ({
    selectedArea, adjacencyData, units, currentPhase, currentEvent,
    selectedUnitId, handleUnitClick,
    handleDawnPhase, handleEventPhase, handleProceedToSupply, handleEndPhase,
    handleSaveGame, handleLoadGame, fileInputRef,
    supplyPoints, getRecoveryCost, getRecoveryAreas, handleRecoverUnit,
}) => {
    const [recoveryTarget, setRecoveryTarget] = useState(null);

    const ooa = units.filter(u => u.faction === 'US' && u.status === 'out_of_action');
    const target = recoveryTarget ? units.find(u => u.id === recoveryTarget) : null;
    const validAreas = target && getRecoveryAreas ? getRecoveryAreas(target) : [];

    return (
    <div style={{
        flex: '0 0 20%',
        background: '#1e1e1e',
        borderRight: '1px solid #444',
        padding: '1rem',
        color: '#eee',
        overflowY: 'auto',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#ffcc00' }}>Manila 1945</h2>

        {/* 選択エリア */}
        <div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>選択エリア</div>
            {selectedArea ? (
                <div style={{ padding: '10px', background: '#333', borderRadius: '4px', border: '1px solid #555' }}>
                    <div style={{ fontSize: '1.1rem', color: '#00ccff', fontWeight: 'bold' }}>{selectedArea.name}</div>
                    <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '4px' }}>地形: {selectedArea.terrain}</div>
                    <div style={{ marginTop: '8px', borderTop: '1px solid #555', paddingTop: '6px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>隣接エリア:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {(adjacencyData[selectedArea.name] ?? []).length > 0
                                ? adjacencyData[selectedArea.name].map(adj => (
                                    <span key={adj} style={{ background: '#444', padding: '2px 5px', borderRadius: '3px', border: '1px solid #555', fontSize: '0.8rem' }}>
                                        {adj}
                                    </span>
                                ))
                                : <span style={{ color: '#777', fontStyle: 'italic', fontSize: '0.8rem' }}>なし</span>
                            }
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ color: '#666', fontStyle: 'italic', fontSize: '0.85rem' }}>マップのエリアをクリック...</div>
            )}
        </div>

        {/* ユニット一覧 */}
        <div style={{ flex: '1 1 0', minHeight: 0 }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {selectedArea ? `${selectedArea.name} のユニット` : '全ユニット'}
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '220px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {units
                    .filter(u => !['eliminated', 'future'].includes(u.status) && (selectedArea ? u.location === selectedArea.name : true))
                    .map(u => {
                        const isSelectable = currentPhase === 'Action' && u.faction === 'US' && u.status === 'fresh';
                        const isSelected = u.id === selectedUnitId;
                        return (
                        <div key={u.id}
                            onClick={() => { if (isSelectable) handleUnitClick(u.id); }}
                            style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 8px',
                            background: isSelected ? '#1a3a6a' : '#2a2a2a',
                            borderRadius: '3px',
                            border: `2px solid ${isSelected ? '#ffcc00' : (u.faction === 'JP' ? '#7a2020' : '#1a4a7a')}`,
                            opacity: u.status === 'out_of_action' ? 0.5 : 1,
                            cursor: isSelectable ? 'pointer' : 'default',
                            boxShadow: isSelected ? '0 0 8px rgba(255,204,0,0.4)' : 'none',
                            transition: 'border 0.15s, background 0.15s, box-shadow 0.15s',
                        }}>
                            <img src={`${BASE}images/${u.frontImage}`} alt={u.id} style={{ width: '42px', height: '42px', borderRadius: '2px', flexShrink: 0 }} />
                            <div style={{ fontSize: '0.875rem', overflow: 'hidden' }}>
                                {getDivisionJa(u.id) && (
                                    <div style={{ color: '#aaa', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getDivisionJa(u.id)}</div>
                                )}
                                <div style={{ color: u.faction === 'JP' ? '#f88' : '#8bf', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {getUnitNameJa(u.id) ?? u.name}
                                </div>
                                <div style={{ color: '#777', fontSize: '0.8rem' }}>{{ fresh: '待機', spent: '消耗', out_of_action: '行動不能', revealed: '判明', eliminated: '除去' }[u.status] ?? u.status}</div>
                            </div>
                        </div>
                        );
                    })
                }
                {units.filter(u => !['eliminated', 'future'].includes(u.status) && (selectedArea ? u.location === selectedArea.name : true)).length === 0 && (
                    <div style={{ color: '#666', fontStyle: 'italic', fontSize: '0.8rem' }}>ユニットなし</div>
                )}
            </div>
        </div>

        {/* OOA部隊の回復 (補給フェーズのみ) */}
        {currentPhase === 'Supply' && ooa.length > 0 && (
            <div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OOA部隊の回復</div>
                <div style={{ background: '#2a2a2a', borderRadius: '4px', border: '1px solid #555', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ color: '#aaa', fontSize: '0.75rem' }}>補給ポイント残: <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{supplyPoints}</span></div>
                    {ooa.map(u => {
                        const cost = getRecoveryCost ? getRecoveryCost(u) : 2;
                        const isSelected = recoveryTarget === u.id;
                        const canAfford = supplyPoints >= cost;
                        return (
                            <div key={u.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px', background: isSelected ? '#1a3a6a' : '#333', borderRadius: '4px', border: `1px solid ${isSelected ? '#ffcc00' : '#444'}` }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.8rem', color: '#8bf' }}>{unitLabel(u)}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#888' }}>{u.type} — {cost}pt</div>
                                    </div>
                                    <button
                                        onClick={() => setRecoveryTarget(isSelected ? null : u.id)}
                                        disabled={!canAfford}
                                        style={{ padding: '3px 8px', background: canAfford ? (isSelected ? '#ffcc00' : '#1a4a2a') : '#333', color: canAfford ? (isSelected ? '#000' : '#4f4') : '#666', border: 'none', borderRadius: '3px', cursor: canAfford ? 'pointer' : 'default', fontSize: '0.75rem' }}
                                    >
                                        {isSelected ? 'キャンセル' : '回復'}
                                    </button>
                                </div>
                                {isSelected && (
                                    <div style={{ padding: '5px 6px', background: '#111', borderRadius: '0 0 4px 4px', border: '1px solid #ffcc00', borderTop: 'none' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#aaa', marginBottom: '3px' }}>配置先:</div>
                                        {validAreas.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                                {validAreas.map(area => (
                                                    <button
                                                        key={area}
                                                        onClick={() => { handleRecoverUnit(u.id, area); setRecoveryTarget(null); }}
                                                        style={{ padding: '3px 8px', background: '#1a4a7a', color: 'white', border: '1px solid #4a8aaa', borderRadius: '3px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                    >
                                                        {area}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ color: '#f88', fontSize: '0.7rem' }}>配置可能エリアなし</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* フェーズボタン */}
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            {currentPhase === 'Dawn' && (
                <button
                    onClick={handleDawnPhase}
                    style={{ width: '100%', padding: '12px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                >
                    夜明けフェーズ実行
                </button>
            )}

            {currentPhase === 'Event' && !currentEvent && (
                <button
                    onClick={handleEventPhase}
                    style={{ width: '100%', padding: '12px', background: '#9c27b0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                >
                    イベントロール
                </button>
            )}

            {currentPhase === 'Event' && currentEvent && (
                <button
                    onClick={handleProceedToSupply}
                    style={{ width: '100%', padding: '12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                >
                    補給フェーズへ &gt;
                </button>
            )}

            {currentPhase === 'End' && (
                <button
                    onClick={handleEndPhase}
                    style={{ width: '100%', padding: '12px', background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                >
                    次のターンへ &gt;
                </button>
            )}
        </div>

        {/* セーブ・ロード */}
        <div style={{ paddingTop: '10px', borderTop: '1px solid #7f8c8d' }}>
            <div style={{ fontSize: '0.9rem', color: '#95a5a6', marginBottom: '5px' }}>システム</div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleSaveGame} style={{ flex: 1, padding: '8px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d', borderRadius: '4px', cursor: 'pointer' }}>
                    セーブ
                </button>
                <button onClick={() => fileInputRef.current.click()} style={{ flex: 1, padding: '8px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d', borderRadius: '4px', cursor: 'pointer' }}>
                    ロード
                </button>
            </div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleLoadGame} accept=".json" />
        </div>
    </div>
    );
};

export default LeftPanel;
