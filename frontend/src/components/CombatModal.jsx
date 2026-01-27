
import React, { useState, useEffect } from 'react';
import './CombatModal.css';

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
const CombatModal = ({ onClose, onApply, onReveal, onStrategyCasualty, attackerUnits = [], defenderUnit, terrain = 'Clear', morale = 19, currentTurn = 1 }) => {
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

    // ... (useEffect omitted)

    // Log helper ...

    // ...

    const processDefenseStrategy = () => {
        if (!defenderUnit) return;

        const strategy = defenderUnit.unitClass;
        const leadUnit = activeAttackers.find(u => u.id === selectedLeadId);
        let newAttackers = [...activeAttackers];
        let strategyLog = `Strategy: ${strategy}`;
        let removedId = null;

        if (strategy === 'Ambush') {
            if (leadUnit) {
                strategyLog += ` -> Ambush! Lead Unit ${leadUnit.name} Eliminated (OOA).`;
                removedId = leadUnit.id;
            }
        } else if (strategy === 'Sniper') {
            const leaders = newAttackers.filter(u => isLeader(u));
            if (leaders.length > 0) {
                const target = leaders[0];
                strategyLog += ` -> Sniper! Leader ${target.name} Eliminated (OOA).`;
                removedId = target.id;
            } else {
                strategyLog += " -> Sniper (No effect, no leader).";
            }
        } else if (strategy === 'Barrage') {
            if (newAttackers.length > 0) {
                const target = newAttackers[newAttackers.length - 1]; // Last unit
                strategyLog += ` -> Barrage! Unit ${target.name} Eliminated (OOA).`;
                removedId = target.id;
            }
        } else if (strategy === 'Fanatic') {
            strategyLog += " -> Fanatic! (Success -> Stalemate)";
        } else if (strategy === 'Elite') {
            strategyLog += " -> Elite! (Defends with 3d6 drop low)";
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
            addLog("All attacking units eliminated by Strategy.", 'danger');
            setStep('RESULT');
            // Even if all eliminated, we might need to apply result (resultType Repulse/Stalemate equivalent?)
            // Technically combat ends immediately.
            // Result should be treated as Repulse or specialized 'StrategyElimination'.
            setCombatResult({ resultTypeActual: 'Repulse', logs: ["Combat ended by Strategy Casualty."] });
        } else {
            setTimeout(() => setStep('SETUP'), 1500);
        }
    };

    const recalculate = async () => {
        // Validation: At least one unit must participate (and not just HQ with 0 attack? 
        // Backend handles "No attacking units" case.
        // We filter activeAttackers by participatingIds.
        const participatingUnits = activeAttackers
            .filter(u => participatingIds.has(u.id))
            .map(u => ({ ...u, is_lead: u.id === selectedLeadId }));

        try {
            const response = await fetch('/api/combat/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attackerUnits: participatingUnits,
                    supportModifiers: support,
                    morale: morale,
                    terrainType: terrain,
                    defenderUnit: {
                        name: defenderUnit.name,
                        defense_factor: defenderUnit.strength || 3,
                        is_elite: defenderUnit.unitClass === 'Elite'
                    },
                    isMandatoryAttack: false,
                    eventCiviActive: false
                })
            });
            const data = await response.json();
            setCalculatedStats(data);
        } catch (e) {
            console.error("Calc Error", e);
            setCalculatedStats({ av: 99, dv: 99, logs: ["API Error"] });
        }
    };

    const handleRoll = async () => {
        setIsRolling(true);
        setStep('RESOLUTION');

        try {
            const response = await fetch('/api/combat/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attackValue: calculatedStats.av,
                    defenseValue: calculatedStats.dv,
                    terrainMod: 0,
                    strategyMod: 0,
                    isElite: defenderUnit.unitClass === 'Elite',
                    hasAirSupport: support.air_support
                })
            });
            const data = await response.json();

            // Check Fanatic Rule
            if (defenderUnit.unitClass === 'Fanatic' && data.is_success && !data.is_overrun) {
                data.is_success = false;
                data.logs.push("Fanatic Defense! Success converted to Stalemate.");
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
            addLog(`Result: ${data.resultTypeActual} (Diff ${data.diff})`, 'result');
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
                defenderUnit: defenderUnit,
                targetArea: "Combat Area",
                currentMorale: morale,
                strategyCasualtyIds: strategyCasualtyIds
            });
        }
        onClose();
    };

    return (
        <div className="combat-overlay">
            <div className="combat-window">
                <div className="combat-header">
                    <div className="combat-title">Combat: {step}</div>
                    <button className="combat-close" onClick={onClose}>×</button>
                </div>

                <div className="combat-body">
                    {/* LEFT: ATTACKER */}
                    <div className="combat-section attacker-section">
                        <div className="section-title">US Forces</div>
                        <div className="unit-list">
                            {activeAttackers.map(u => (
                                <div
                                    key={u.id}
                                    className={`unit-card ${u.id === selectedLeadId ? 'lead' : ''} ${!participatingIds.has(u.id) ? 'inactive' : ''}`}
                                    onClick={() => {
                                        if (step === 'RESULT') return;
                                        // Click logic: 
                                        // 1. If clicking lead, do nothing (Lead must participate).
                                        // 2. If clicking others, toggle participation.
                                        // 3. To change lead, use a separate action? Or double click?
                                        // Spec says: "Who participates". Lead must be one of them.
                                        // Let's assume clicking makes it Lead if active, or toggles participation?
                                        // Better UI: Checkbox for participation. Body click for Lead.
                                        // Let's implement body click -> Set Lead (if active). 
                                        // Add a small checkbox div for participation.
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
                                        <div className="unit-name">{u.name}</div>
                                        <div className="unit-stats">AF: {u.attack_factor} {u.id === selectedLeadId ? '(Lead)' : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {(step === 'SETUP' || step === 'RESULT') && (
                            <>
                                <div className="section-title">Support (Max {participatingIds.size})</div>
                                {/* Mixed Formation Warning */}
                                {calculatedStats.logs.some(l => l.includes("Parent Formation Penalty")) && (
                                    <div style={{ color: "orange", fontSize: "0.8rem", marginBottom: "4px" }}>
                                        ⚠️ Mixed Formation Penalty Active (-1)
                                    </div>
                                )}
                                <div className="modifiers-grid">
                                    <button className={`mod-btn ${support.artillery > 0 ? 'active' : ''}`} onClick={() => handleSupportCycle('artillery')}>
                                        Arty x{support.artillery}
                                    </button>
                                    <button className={`mod-btn ${support.engineer > 0 ? 'active' : ''}`} onClick={() => handleSupportCycle('engineer')}>
                                        Eng x{support.engineer}
                                    </button>
                                    <button className={`mod-btn ${support.air_support ? 'active' : ''}`} onClick={() => handleSupportCycle('air_support')}>
                                        Air {support.air_support ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                                <div className="stats-display">
                                    <div className="stat-label">Total AV</div>
                                    <div className="stat-value">{calculatedStats.av}</div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* CENTER ACTION */}
                    <div className="action-section">
                        {step === 'CONTACT' && (
                            <button className="roll-btn" onClick={handleReveal} style={{ fontSize: '0.9rem', width: 120, height: 60, borderRadius: 8 }}>
                                REVEAL
                            </button>
                        )}
                        {step === 'STRATEGY' && (
                            <div style={{ color: 'yellow' }}>Enemy Strategy...</div>
                        )}
                        {step === 'SETUP' && (
                            <button className="roll-btn" onClick={handleRoll} disabled={isRolling}>
                                {isRolling ? '...' : 'ROLL'}
                            </button>
                        )}
                        {step === 'RESULT' && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'yellow' }}>{combatResult?.resultTypeActual}</div>
                                <button className="mod-btn active" onClick={handleApply} style={{ marginTop: 20, width: 100 }}>APPLY</button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: DEFENDER */}
                    <div className="combat-section defender-section">
                        <div className="section-title">JP Forces</div>
                        <div className="terrain-badge">{terrain}</div>

                        <div className="unit-list">
                            {!isRevealed ? (
                                <div className="unit-card" style={{ opacity: 0.6 }}>
                                    <div className="unit-card-icon">?</div>
                                    <div className="unit-info">
                                        <div className="unit-name">Hidden Unit</div>
                                        <div className="unit-stats">???</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="unit-card">
                                    <div className="unit-card-icon" style={{ background: '#c53030' }}>JP</div>
                                    <div className="unit-info">
                                        <div className="unit-name">{defenderUnit.name}</div>
                                        <div className="unit-stats">DF: {defenderUnit.strength} / {defenderUnit.unitClass}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {(step === 'SETUP' || step === 'RESULT') && (
                            <>
                                <div className="section-title">JP Stats</div>
                                <div className="stats-display">
                                    <div className="stat-label">Total DV</div>
                                    <div className="stat-value">{calculatedStats.dv}</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="combat-footer">
                    <div className="section-title">Logs</div>
                    <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                        {combatLogs.map((l, i) => <div key={i} className={`log-message ${l.type}`}>{l.msg}</div>)}
                        {combatResult?.logs.map((l, i) => <div key={'r' + i} className="log-message result">{l}</div>)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CombatModal;
