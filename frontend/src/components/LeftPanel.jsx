import { getUnitNameJa, getDivisionJa } from '../logic/unitNames';

const BASE = import.meta.env.BASE_URL;

const LeftPanel = ({
    selectedArea, adjacencyData, units, currentPhase, currentEvent,
    selectedUnitId, handleUnitClick,
    handleDawnPhase, handleEventPhase, handleProceedToSupply, handleEndPhase,
    handleSaveGame, handleLoadGame, fileInputRef,
}) => (
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
                                <div style={{ color: '#777', fontSize: '0.8rem' }}>{u.status}</div>
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

        {/* フェーズボタン */}
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            {currentPhase === 'Dawn' && (
                <button
                    onClick={handleDawnPhase}
                    style={{ width: '100%', padding: '12px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                >
                    Execute Dawn Phase
                </button>
            )}

            {currentPhase === 'Event' && !currentEvent && (
                <button
                    onClick={handleEventPhase}
                    style={{ width: '100%', padding: '12px', background: '#9c27b0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                >
                    Roll Event
                </button>
            )}

            {currentPhase === 'Event' && currentEvent && (
                <button
                    onClick={handleProceedToSupply}
                    style={{ width: '100%', padding: '12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                >
                    To Supply Phase &gt;
                </button>
            )}

            <button
                onClick={handleEndPhase}
                style={{ width: '100%', padding: '12px', background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
            >
                End Phase
            </button>
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

export default LeftPanel;
