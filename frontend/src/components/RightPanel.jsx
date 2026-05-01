const BASE = import.meta.env.BASE_URL;

const RightPanel = ({
    turn, currentPhase, morale, supplyPoints, supplyRolled, hasBeenShaken,
    usControlledAreas, supportUnits, units, setContextMenu,
    handleSupplyRoll, handleImproveMorale, handleProceedToAction, handleEndTurn,
    handleBuySupport, handleOOAHover,
}) => (
    <div style={{
        flex: '0 0 20%',
        background: '#1e1e1e',
        borderLeft: '1px solid #444',
        padding: '1rem',
        color: '#eee',
        overflowY: 'auto',
        boxSizing: 'border-box',
    }}>
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '5px', color: '#ff9900' }}>リソース</h3>

        <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
            <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>ターン</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{turn} / 9</div>
            </div>
            <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>フェーズ</div>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#00ccff' }}>{currentPhase}</div>
            </div>
            <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>米軍士気</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: morale >= 10 ? '#2196f3' : '#ff9800' }}>
                    {morale} {morale >= 10 ? '(強固)' : '(動揺)'}
                </div>
            </div>
            <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>米軍補給</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4caf50' }}>{supplyPoints}</div>
            </div>
            <div style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>米軍支配</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ff9800' }}>{usControlledAreas.length} / 34</div>
            </div>
        </div>

        {/* 補給アクション */}
        <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#8bc34a' }}>補給アクション</h3>
            <div style={{ padding: '10px', background: '#333', borderRadius: '4px', border: '1px solid #555' }}>
                {currentPhase === 'Supply' && !supplyRolled && (
                    <div style={{ marginBottom: '10px' }}>
                        <button onClick={handleSupplyRoll} style={{ width: '100%', background: '#ff9800', color: 'white', padding: '8px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                            補給ダイス (4d6)
                        </button>
                    </div>
                )}

                {currentPhase === 'Supply' && supplyRolled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#ccc', fontStyle: 'italic' }}>
                            補給ポイントを消費して支援を購入、部隊を回復、または士気を向上させます。
                        </div>
                        <button
                            onClick={handleImproveMorale}
                            disabled={supplyPoints < 3 || morale >= 19}
                            style={{
                                width: '100%',
                                background: supplyPoints >= 3 && morale < 19 ? '#2196f3' : '#555',
                                color: 'white', padding: '8px', border: 'none',
                                cursor: supplyPoints >= 3 && morale < 19 ? 'pointer' : 'not-allowed',
                                borderRadius: '4px',
                            }}
                        >
                            +1 士気 ($3) {morale >= 19 ? '(最大)' : ''}
                        </button>
                        <hr style={{ borderColor: '#555', width: '100%', margin: '5px 0' }} />
                        <button
                            onClick={handleProceedToAction}
                            style={{ width: '100%', background: '#4caf50', color: 'white', padding: '12px', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}
                        >
                            補給フェーズ終了 (アクション開始) &gt;
                        </button>
                    </div>
                )}

                {currentPhase === 'Action' && (
                    <div style={{ paddingTop: '10px', borderTop: '1px solid #555', marginTop: '10px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px', fontStyle: 'italic' }}>
                            部隊を移動するか、エリアを右クリックして戦闘を解決します。
                        </div>
                        <button
                            onClick={handleEndTurn}
                            style={{ width: '100%', background: '#e91e63', color: 'white', padding: '12px', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}
                        >
                            アクションフェーズ終了 (ターン終了) &gt;
                        </button>
                    </div>
                )}

                {currentPhase !== 'Supply' && currentPhase !== 'Action' && (
                    <div style={{ fontSize: '0.8rem', color: '#777' }}>
                        補給アクションは補給フェーズで利用可能です。
                    </div>
                )}
            </div>
        </div>

        {/* 支援部隊 */}
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '5px', color: '#ff9900' }}>支援部隊</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {Object.keys(supportUnits).map(key => {
                const s = supportUnits[key];
                const canBuy = currentPhase === 'Supply' && supplyRolled && supplyPoints >= s.cost && (s.available + s.used) < s.max;
                const isLocked = key === 'air' && !hasBeenShaken;
                return (
                    <div key={key} style={{ padding: '10px', background: '#2a2a2a', borderRadius: '4px', border: '1px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 'bold', color: '#ddd' }}>{s.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                                利用可能: <span style={{ color: '#fff' }}>{s.available}</span> / 使用済み: <span style={{ color: '#fa8' }}>{s.used}</span> (最大: {s.max})
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#aaa' }}>コスト: {s.cost}</div>
                        </div>
                        <button
                            onClick={() => handleBuySupport(key)}
                            disabled={!canBuy || isLocked}
                            style={{
                                padding: '4px 8px', fontSize: '0.8rem',
                                cursor: (!canBuy || isLocked) ? 'not-allowed' : 'pointer',
                                background: (!canBuy || isLocked) ? '#555' : '#8bc34a',
                                color: 'white', border: 'none', borderRadius: '2px',
                            }}
                        >
                            購入
                        </button>
                    </div>
                );
            })}
        </div>

        {/* 行動不能 */}
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '5px', color: '#ff9900' }}>行動不能 (OOA)</h3>
        <div style={{ minHeight: '60px', background: '#2a2a2a', padding: '10px', borderRadius: '4px', border: '1px dashed #555' }}>
            {units.filter(u => u.status === 'out_of_action').length === 0 ? (
                <div style={{ color: '#777', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>損失なし</div>
            ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {units.filter(u => u.status === 'out_of_action').map(u => (
                        <img
                            key={u.id}
                            src={`${BASE}images/${u.frontImage}`}
                            alt={u.id}
                            style={{ width: '50px', height: '50px', borderRadius: '4px', cursor: 'context-menu', opacity: 0.8, border: '1px solid #777' }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, unitId: u.id, type: 'recover' });
                            }}
                            onMouseEnter={() => handleOOAHover(u, true)}
                            onMouseLeave={() => handleOOAHover(u, false)}
                            title={`${u.name}\n右クリックで回復`}
                        />
                    ))}
                </div>
            )}
        </div>
    </div>
);

export default RightPanel;
