
import React, { useState, useEffect } from 'react';
import './CombatModal.css';
import { calculateCombatStats } from '../logic/combatCalc';
import { resolveCombat } from '../logic/combatResolution';
import { unitLabel } from '../logic/unitNames';

/**
 * CombatModal
 * 
 * Props:
 * - onClose: function
 * - onApply: function(resultData) -> void
 * - onReveal: function(unitId) -> void
 * - attackerUnits: Array
 * - defenderUnit: Object 
 * - terrain: string
 * - morale: number
 * - currentTurn: number (NEW)
 */
const CombatModal = ({ onClose, onApply, onReveal, onStrategyCasualty, attackerUnits = [], defenderUnit, terrain = 'Clear', morale = 19, currentTurn = 1, supportUnits = {} }) => {
    // Steps: 'CONTACT' -> 'STRATEGY' -> 'SETUP' -> 'RESOLUTION' -> 'RESULT'
    const [step, setStep] = useState('CONTACT');

    // State
    const [selectedLeadId, setSelectedLeadId] = useState(null);
    const [activeAttackers, setActiveAttackers] = useState([]);
    const [isRevealed, setIsRevealed] = useState(false);
    const [strategyCasualtyIds, setStrategyCasualtyIds] = useState([]); // Track strategy kills

    // Modifiers
    const [support, setSupport] = useState({ artillery: 0, engineer: 0, air_support: false });

    // Calculation & Result
    const [calculatedStats, setCalculatedStats] = useState({ av: 0, dv: 0, logs: [] });
    // ... (rest of state)
    const [participatingIds, setParticipatingIds] = useState(new Set());
    const [combatLogs, setCombatLogs] = useState([]);
    const [combatResult, setCombatResult] = useState(null);
    const [isRolling, setIsRolling] = useState(false);

    // Initialization check
    useEffect(() => {
        if (attackerUnits.length > 0) {
            setActiveAttackers(attackerUnits);
            // Default: All participate initially
            setParticipatingIds(new Set(attackerUnits.map(u => u.id)));
            // Auto Select Lead (Highest AV or first) for display
            setSelectedLeadId(attackerUnits[0].id);
        }
    }, [attackerUnits]);

    useEffect(() => {
        if (step === 'SETUP' && selectedLeadId && activeAttackers.length > 0) {
            recalculate();
        }
    }, [step, selectedLeadId, participatingIds, support, activeAttackers]);

    const addLog = (msg, type = 'info') => {
        setCombatLogs(prev => [...prev, { msg, type }]);
    };

    const isLeader = (unit) => /HQ|Gen|Leader|Beightler|Chase|Haugen|Griswold/i.test(unit.name) || /HQ/i.test(unit.type);

    const handleReveal = () => {
        setIsRevealed(true);
        if (onReveal && defenderUnit) {
            onReveal(defenderUnit.id);
        }
        setStep('STRATEGY');
        setTimeout(() => processDefenseStrategy(), 1000);
    };

    const STRATEGY_JA = { Ambush: '待ち伏せ', Sniper: '狙撃', Barrage: '砲撃', Fanatic: '狂信', Elite: '精鋭', Infantry: '歩兵' };

    const processDefenseStrategy = () => {
        if (!defenderUnit) return;

        const strategy = defenderUnit.unitClass;
        const leadUnit = activeAttackers.find(u => u.id === selectedLeadId);
        let newAttackers = [...activeAttackers];
        let strategyLog = `防衛戦略: ${STRATEGY_JA[strategy] ?? strategy}`;
        let removedId = null;

        if (strategy === 'Ambush') {
            if (leadUnit) {
                strategyLog += ` -> 待ち伏せ！先導部隊 ${unitLabel(leadUnit)} を除去 (行動不能)。`;
                removedId = leadUnit.id;
            }
        } else if (strategy === 'Sniper') {
            const leaders = newAttackers.filter(u => isLeader(u));
            if (leaders.length > 0) {
                const target = leaders[0];
                strategyLog += ` -> 狙撃！指揮官 ${unitLabel(target)} を除去 (行動不能)。`;
                removedId = target.id;
            } else {
                strategyLog += ' -> 狙撃 (効果なし、指揮官不在)。';
            }
        } else if (strategy === 'Barrage') {
            if (newAttackers.length > 0) {
                const target = newAttackers[newAttackers.length - 1]; // Last unit
                strategyLog += ` -> 砲撃！部隊 ${unitLabel(target)} を除去 (行動不能)。`;
                removedId = target.id;
            }
        } else if (strategy === 'Fanatic') {
            strategyLog += ' -> 狂信的！(成功 -> 膠着)';
        } else if (strategy === 'Elite') {
            strategyLog += ' -> 精鋭！(3d6最低値除外で防衛)';
        }

        if (removedId) {
            newAttackers = newAttackers.filter(u => u.id !== removedId);
            setStrategyCasualtyIds(prev => [...prev, removedId]);

            if (onStrategyCasualty) {
                onStrategyCasualty([removedId]);
            }

            // If lead removed, reassign lead
            if (removedId === selectedLeadId) {
                setSelectedLeadId(newAttackers.length > 0 ? newAttackers[0].id : null);
            }
        }

        setActiveAttackers(newAttackers);
        addLog(strategyLog, 'danger');

        if (newAttackers.length === 0) {
            addLog('全攻撃部隊が防衛戦略により除去。', 'danger');
            setStep('RESULT');
            setCombatResult({ resultTypeActual: 'Repulse', logs: ['防衛戦略損害により戦闘終了。'] });
        } else {
            setTimeout(() => setStep('SETUP'), 1500);
        }
    };

    const handleSupportCycle = (type) => {
        if (step === 'RESULT') return;
        setSupport(prev => {
            if (type === 'air_support') {
                const avail = supportUnits?.air?.available ?? 0;
                if (!prev.air_support && avail === 0) return prev;
                return { ...prev, air_support: !prev.air_support };
            }
            const avail = supportUnits?.[type]?.available ?? 0;
            if (avail === 0) return prev;
            const next = (prev[type] + 1) % (avail + 1);
            return { ...prev, [type]: next };
        });
    };

    const recalculate = () => {
        const participatingUnits = activeAttackers
            .filter(u => participatingIds.has(u.id))
            .map(u => ({ ...u, is_lead: u.id === selectedLeadId }));

        const data = calculateCombatStats({
            attackerUnits: participatingUnits,
            supportModifiers: support,
            morale,
            terrainType: terrain,
            defenderUnit: defenderUnit ? {
                name: defenderUnit.name,
                defense_factor: defenderUnit.strength ?? 3,
                is_elite: defenderUnit.unitClass === 'Elite',
            } : null,
            isMandatoryAttack: false,
            eventCiviActive: false,
        });
        setCalculatedStats(data);
    };

    const handleRoll = async () => {
        setIsRolling(true);
        setStep('RESOLUTION');

        try {
            const data = resolveCombat({
                attackValue:  calculatedStats.av,
                defenseValue: calculatedStats.dv,
                baseDefenseValue: calculatedStats.baseDv,
                terrainMod:   calculatedStats.terrainMod,
                isElite:      defenderUnit.unitClass === 'Elite',
                hasAirSupport: support.air_support,
                terrainType:  terrain,
            });

            // Check Fanatic Rule
            if (defenderUnit.unitClass === 'Fanatic' && data.is_success && !data.is_overrun) {
                data.is_success = false;
                data.logs.push('狂信的防衛！成功が膠着に変換。');
                data.resultTypeActual = 'Stalemate';
            } else {
                if (data.is_overrun) data.resultTypeActual = 'Overrun';
                else if (data.is_success) data.resultTypeActual = 'Success';
                else data.resultTypeActual = 'Repulse';
            }

            if (!data.resultTypeActual) {
                let rType = 'Repulse';
                if (data.diff === 0) rType = 'Stalemate';
                if (data.diff > 0) rType = 'Success';
                if (data.is_overrun) rType = 'Overrun';
                data.resultTypeActual = rType;
            }

            if (defenderUnit.unitClass === 'Fanatic' && data.resultTypeActual === 'Success') {
                data.resultTypeActual = 'Stalemate';
            }

            setCombatResult(data);
            const RESULT_JA = { Success: '成功', Repulse: '撃退', Stalemate: '膠着', Overrun: '突破' };
            addLog(`結果: ${RESULT_JA[data.resultTypeActual] ?? data.resultTypeActual} (差分 ${data.diff})`, 'result');
            setStep('RESULT');

        } catch (e) {
            console.error(e);
        } finally {
            setIsRolling(false);
        }
    };

    const handleApply = () => {
        if (onApply && combatResult) {
            onApply({
                resultType: combatResult.resultTypeActual,
                attackerUnits: activeAttackers.filter(u => participatingIds.has(u.id)).map(u => ({ ...u, is_lead: u.id === selectedLeadId })),
                defenderUnit: isRevealed ? { ...defenderUnit, status: 'revealed' } : defenderUnit,
                targetArea: "Combat Area",
                currentMorale: morale,
                strategyCasualtyIds: strategyCasualtyIds,
                supportUsed: support,
            });
        }
        onClose();
    };

    // Display helpers
    const getStepLabel = (s) => {
        switch (s) {
            case 'CONTACT': return '接敵 (Contact)';
            case 'STRATEGY': return '戦略 (Strategy)';
            case 'SETUP': return '準備 (Setup)';
            case 'RESOLUTION': return '解決 (Resolution)';
            case 'RESULT': return '結果 (Result)';
            default: return s;
        }
    };

    const getResultLabel = (r) => {
        switch (r) {
            case 'Success': return '成功 (JP除去)';
            case 'Repulse': return '撃退 (米軍損害)';
            case 'Stalemate': return '膠着 (痛み分け)';
            case 'Overrun': return 'オーバーラン (完全勝利)';
            default: return r;
        }
    };

    return (
        <div className="combat-overlay">
            <div className="combat-window">
                <div className="combat-header">
                    <div className="combat-title">戦闘フェーズ: {getStepLabel(step)}</div>
                    <button className="combat-close" onClick={onClose}>×</button>
                </div>

                <div className="combat-body">
                    {/* LEFT: ATTACKER */}
                    <div className="combat-section attacker-section">
                        <div className="section-title">米軍 (US Forces)</div>
                        <div className="unit-list">
                            {activeAttackers.map(u => (
                                <div
                                    key={u.id}
                                    className={`unit-card ${u.id === selectedLeadId ? 'lead' : ''} ${!participatingIds.has(u.id) ? 'inactive' : ''}`}
                                    onClick={() => {
                                        if (step === 'RESULT') return;
                                        if (participatingIds.has(u.id)) setSelectedLeadId(u.id);
                                    }}
                                    style={{ cursor: step !== 'RESULT' ? 'pointer' : 'default', opacity: participatingIds.has(u.id) ? 1 : 0.5 }}
                                >
                                    {/* Checkbox for Participation */}
                                    <div
                                        className="participation-toggle"
                                        style={{ marginRight: 8, cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation(); // prevent Lead select
                                            if (step === 'RESULT') return;
                                            toggleParticipation(u.id);
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={participatingIds.has(u.id)}
                                            disabled={u.id === selectedLeadId} // Lead must participate
                                            readOnly
                                        />
                                    </div>

                                    <div className="unit-card-icon">
                                        {u.type === 'Tank' ? 'Tk' : isLeader(u) ? 'HQ' : 'Inf'}
                                    </div>
                                    <div className="unit-info">
                                        <div className="unit-name">{unitLabel(u)}</div>
                                        <div className="unit-stats">攻撃: {u.attack_factor} {u.id === selectedLeadId ? '(先導)' : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {(step === 'SETUP' || step === 'RESULT') && (
                            <>
                                <div className="section-title">支援 (最大 {participatingIds.size})</div>
                                {/* Mixed Formation Warning */}
                                {calculatedStats.logs.some(l => l.includes("Parent Formation Penalty")) && (
                                    <div style={{ color: "orange", fontSize: "0.8rem", marginBottom: "4px" }}>
                                        ⚠️ 混合部隊ペナルティ (-1)
                                    </div>
                                )}
                                <div className="modifiers-grid">
                                    {(() => {
                                        const artyAvail = supportUnits?.artillery?.available ?? 0;
                                        const engAvail  = supportUnits?.engineer?.available  ?? 0;
                                        const airAvail  = supportUnits?.air?.available       ?? 0;
                                        return (<>
                                            <button
                                                className={`mod-btn ${support.artillery > 0 ? 'active' : ''}`}
                                                onClick={() => handleSupportCycle('artillery')}
                                                disabled={artyAvail === 0 && support.artillery === 0}
                                                title={`在庫: ${artyAvail}`}
                                            >
                                                砲兵 {support.artillery}/{artyAvail}
                                            </button>
                                            <button
                                                className={`mod-btn ${support.engineer > 0 ? 'active' : ''}`}
                                                onClick={() => handleSupportCycle('engineer')}
                                                disabled={engAvail === 0 && support.engineer === 0}
                                                title={`在庫: ${engAvail}`}
                                            >
                                                工兵 {support.engineer}/{engAvail}
                                            </button>
                                            <button
                                                className={`mod-btn ${support.air_support ? 'active' : ''}`}
                                                onClick={() => handleSupportCycle('air_support')}
                                                disabled={airAvail === 0 && !support.air_support}
                                                title={`在庫: ${airAvail}`}
                                            >
                                                航空 {support.air_support ? 'ON' : 'OFF'}
                                            </button>
                                        </>);
                                    })()}
                                </div>
                                <div className="stats-display">
                                    <div className="stat-label">総攻撃力 (AV)</div>
                                    <div className="stat-value">{calculatedStats.av}</div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* CENTER ACTION */}
                    <div className="action-section">
                        {step === 'CONTACT' && (
                            <button className="roll-btn" onClick={handleReveal} style={{ fontSize: '0.9rem', width: 120, height: 60, borderRadius: 8 }}>
                                敵軍公開<br />(REVEAL)
                            </button>
                        )}
                        {step === 'STRATEGY' && (
                            <div style={{ color: 'yellow' }}>敵軍戦略発動中...</div>
                        )}
                        {step === 'SETUP' && (
                            <button className="roll-btn" onClick={handleRoll} disabled={isRolling}>
                                {isRolling ? '...' : 'ダイスロール'}
                            </button>
                        )}
                        {step === 'RESULT' && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'yellow' }}>
                                    {getResultLabel(combatResult?.resultTypeActual)}
                                </div>
                                <button className="mod-btn active" onClick={handleApply} style={{ marginTop: 20, width: 100 }}>結果適用</button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: DEFENDER */}
                    <div className="combat-section defender-section">
                        <div className="section-title">日本軍 (JP Forces)</div>
                        <div className="terrain-badge">{terrain}</div>

                        <div className="unit-list">
                            {!isRevealed ? (
                                <div className="unit-card" style={{ opacity: 0.6 }}>
                                    <div className="unit-card-icon">?</div>
                                    <div className="unit-info">
                                        <div className="unit-name">未確認部隊</div>
                                        <div className="unit-stats">???</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="unit-card">
                                    <div className="unit-card-icon" style={{ background: '#c53030' }}>JP</div>
                                    <div className="unit-info">
                                        <div className="unit-name">{unitLabel(defenderUnit)}</div>
                                        <div className="unit-stats">防御: {defenderUnit.strength} / {defenderUnit.unitClass}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {(step === 'SETUP' || step === 'RESULT') && (
                            <>
                                <div className="section-title">防御力</div>
                                <div className="stats-display">
                                    <div className="stat-label">総防御力 (DV)</div>
                                    <div className="stat-value">{calculatedStats.dv}</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="combat-footer">
                    <div className="section-title">ログ (Logs)</div>
                    <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                        {step === 'SETUP' && calculatedStats.logs && calculatedStats.logs.map((l, i) => (
                            <div key={'c' + i} className="log-message info" style={{ color: '#aaa', fontStyle: 'italic' }}>• {l}</div>
                        ))}
                        {combatLogs.map((l, i) => <div key={i} className={`log-message ${l.type}`}>{l.msg}</div>)}
                        {combatResult?.logs.map((l, i) => <div key={'r' + i} className="log-message result">{l}</div>)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CombatModal;
