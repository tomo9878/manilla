
import React, { useState, useEffect } from 'react';
import './CombatModal.css';

/**
 * CombatModal
 * 
 * Props:
 * - onClose: function
 * - onApply: function(resultData) -> void
 * - attackerUnits: Array
 * - defenderUnit: Object (The actual unit, hidden initially)
 * - terrain: string
 * - morale: number
 */
const CombatModal = ({ onClose, onApply, attackerUnits = [], defenderUnit, terrain = 'Clear', morale = 19 }) => {
    // Steps: 'CONTACT' -> 'STRATEGY' -> 'SETUP' -> 'RESOLUTION' -> 'RESULT'
    const [step, setStep] = useState('CONTACT');

    // State
    const [selectedLeadId, setSelectedLeadId] = useState(null);
    const [activeAttackers, setActiveAttackers] = useState([]);
    const [isRevealed, setIsRevealed] = useState(false);

    // Modifiers
    const [support, setSupport] = useState({ artillery: 0, engineer: 0, air_support: false });

    // Calculation & Result
    const [calculatedStats, setCalculatedStats] = useState({ av: 0, dv: 0, logs: [] });
    const [combatResult, setCombatResult] = useState(null);
    const [isRolling, setIsRolling] = useState(false);
    const [combatLogs, setCombatLogs] = useState([]);

    // Initialize
    useEffect(() => {
        // Deep copy attackers to manage local state (removal by events)
        setActiveAttackers(attackerUnits.map(u => ({ ...u })));

        // Auto-select lead
        if (attackerUnits.length > 0) {
            const propsLead = attackerUnits.find(u => u.is_lead);
            setSelectedLeadId(propsLead ? propsLead.id : attackerUnits[0].id);
        }
    }, [attackerUnits]);

    // Recalculate stats whenever inputs change (Only in SETUP phase really, but keep reactive)
    useEffect(() => {
        if (step === 'SETUP' || step === 'RESOLUTION') {
            recalculate();
        }
    }, [support, activeAttackers, selectedLeadId, isRevealed, step]);

    const addLog = (msg, type = 'info') => {
        setCombatLogs(prev => [...prev, { msg, type }]);
    };

    // --- Actions ---

    const handleReveal = () => {
        if (!selectedLeadId) {
            alert("Please select a Lead Unit first.");
            return;
        }

        setIsRevealed(true);
        setStep('STRATEGY');
        addLog("Enemy Revealed!", 'warning');

        // Process Strategy
        processDefenseStrategy();
    };

    const processDefenseStrategy = () => {
        if (!defenderUnit) return;

        const strategy = defenderUnit.unitClass; // Sniper, Ambush, etc.
        const leadUnit = activeAttackers.find(u => u.id === selectedLeadId);
        let newAttackers = [...activeAttackers];
        let strategyLog = `Strategy: ${strategy}`;

        if (strategy === 'Ambush') {
            if (leadUnit) {
                strategyLog += ` -> Ambush! Lead Unit ${leadUnit.name} Eliminated (OOA).`;
                // Remove lead
                newAttackers = newAttackers.filter(u => u.id !== leadUnit.id);
                // Reset lead if removed
                setSelectedLeadId(newAttackers.length > 0 ? newAttackers[0].id : null);
            }
        } else if (strategy === 'Sniper') {
            // Remove Leader
            const leaders = newAttackers.filter(u => u.type === 'Leader');
            if (leaders.length > 0) {
                const target = leaders[0];
                strategyLog += ` -> Sniper! Leader ${target.name} Eliminated (OOA).`;
                newAttackers = newAttackers.filter(u => u.id !== target.id);
                if (target.id === selectedLeadId) {
                    setSelectedLeadId(newAttackers.length > 0 ? newAttackers[0].id : null);
                }
            } else {
                strategyLog += " -> Sniper (No effect, no leader).";
            }
        } else if (strategy === 'Barrage') {
            // Simplified: Remove 1 random unit or ask user?
            // User request impl: "Barrage: US must choose 1 unit OOA or Retreat".
            // Implementation: Simple First Unit OOA for now to keep flow automated.
            if (newAttackers.length > 0) {
                const target = newAttackers[newAttackers.length - 1]; // Remove last added (support?)
                strategyLog += ` -> Barrage! Unit ${target.name} Eliminated (OOA).`;
                newAttackers = newAttackers.filter(u => u.id !== target.id);
                if (target.id === selectedLeadId) {
                    setSelectedLeadId(newAttackers.length > 0 ? newAttackers[0].id : null);
                }
            }
        } else if (strategy === 'Fanatic') {
            strategyLog += " -> Fanatic! (Will force Stalemate if Success, unless Overrun)";
        } else if (strategy === 'Elite') {
            strategyLog += " -> Elite! (Defends with 3d6 drop low)";
        }

        setActiveAttackers(newAttackers);
        addLog(strategyLog, 'danger');

        // Check if any attackers left
        if (newAttackers.length === 0) {
            addLog("All attacking units eliminated by Strategy.", 'danger');
            setStep('RESULT'); // End early
        } else {
            setTimeout(() => setStep('SETUP'), 1000); // Auto advance to setup after effect
        }
    };

    const recalculate = async () => {
        // Call Backend API
        try {
            const response = await fetch('/api/combat/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attackerUnits: activeAttackers.map(u => ({ ...u, is_lead: u.id === selectedLeadId })),
                    supportModifiers: support,
                    morale: morale,
                    terrainType: terrain,
                    defenderUnit: {
                        name: defenderUnit.name,
                        defense_factor: defenderUnit.strength || 3,
                        is_elite: defenderUnit.unitClass === 'Elite'
                    },
                    isMandatoryAttack: false, // Need to pass this in props if relevant
                    eventCiviActive: false
                })
            });
            const data = await response.json();
            setCalculatedStats(data);
        } catch (e) {
            console.error("Calc Error", e);
            // Fallback mock
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
                    defenseValue: calculatedStats.dv, // This DV includes base + terrain + shaken from calculate? 
                    // No, process_combat takes BaseDF Separate? 
                    // Let's check game_logic. process_combat(av, dv, t_mod, s_mod).
                    // calculate_stats returns 'dv' which is Total DV (Base+Terrain+Shaken).
                    // So if we pass that as defenseValue, we should set modifiers to 0 in resolve?
                    // Yes, or game_logic double counts.
                    // game_logic calculate_combat_stats returns 'dv' = base + terrain + shaken.
                    // game_logic process_combat takes 'defense_val', 'terrain_mod', 'strategy_mod' and ADDS them.
                    // So we must be careful.
                    // Let's pass calculated 'dv' as defenseValue and 0 as mods.
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
                // Fanatic cancels Success -> Stalemate
                data.is_success = false;
                data.logs.push("Fanatic Defense! Success converted to Stalemate.");
                data.resultTypeActual = 'Stalemate';
            } else {
                if (data.is_overrun) data.resultTypeActual = 'Overrun';
                else if (data.is_success) data.resultTypeActual = 'Success';
                else data.resultTypeActual = 'Repulse'; // Stalemate condition check in logic? 
                // Logic says AT < DT is Fail. Repulse? 
                // User says AT < DT = Repulse. AT = DT = Stalemate.
                // process_combat diff = AT - DT.
                // If diff < 0 -> Repulse.
                // If diff == 0 -> Stalemate.
                // If diff > 0 -> Success.
                // My process_combat only returns is_success (diff>0).
                // I need to interpret diff.
            }

            // Refine Result Type
            let rType = 'Repulse';
            if (data.diff === 0) rType = 'Stalemate';
            if (data.diff > 0) rType = 'Success';
            if (data.is_overrun) rType = 'Overrun';

            // Fanatic Check Again
            if (defenderUnit.unitClass === 'Fanatic' && rType === 'Success') {
                rType = 'Stalemate';
                data.logs.push("Fanatic: Success -> Stalemate");
            }

            data.resultTypeActual = rType;
            setCombatResult(data);
            addLog(`Result: ${rType} (Diff ${data.diff})`, 'result');
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
                attackerUnits: activeAttackers.map(u => ({ ...u, is_lead: u.id === selectedLeadId })),
                defenderUnit: defenderUnit,
                targetArea: "Combat Area", // Mock
                currentMorale: morale
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
                                    className={`unit-card ${u.id === selectedLeadId ? 'lead' : ''}`}
                                    onClick={() => step !== 'RESULT' && setSelectedLeadId(u.id)}
                                    style={{ cursor: step !== 'RESULT' ? 'pointer' : 'default' }}
                                >
                                    <div className="unit-card-icon">{u.type === 'Tank' ? 'Tk' : 'Inf'}</div>
                                    <div className="unit-info">
                                        <div className="unit-name">{u.name}</div>
                                        <div className="unit-stats">AF: {u.attack_factor} {u.id === selectedLeadId ? '(Lead)' : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {(step === 'SETUP' || step === 'RESULT') && (
                            <>
                                <div className="section-title">Support</div>
                                <div className="modifiers-grid">
                                    <button className={`mod-btn ${support.artillery > 0 ? 'active' : ''}`} onClick={() => setSupport(p => ({ ...p, artillery: (p.artillery + 1) % 3 }))}>Arty x{support.artillery}</button>
                                    <button className={`mod-btn ${support.engineer > 0 ? 'active' : ''}`} onClick={() => setSupport(p => ({ ...p, engineer: (p.engineer + 1) % 2 }))}>Eng x{support.engineer}</button>
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
                                <div className="section-title">JP Mods</div>
                                <div className="modifiers-grid">
                                    <button
                                        className={`mod-btn ${support.air_support ? 'active' : ''}`}
                                        onClick={() => setSupport(p => ({ ...p, air_support: !p.air_support }))}
                                    >Air Support {support.air_support ? 'ON' : 'OFF'}</button>
                                </div>
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
