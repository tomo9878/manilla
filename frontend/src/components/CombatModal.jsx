
import React, { useState, useEffect } from 'react';
import './CombatModal.css';

/**
 * CombatModal
 * 
 * Props:
 * - onClose: function
 * - attackerUnits: Array of unit objects
 * - defenderUnit: Object or null
 * - terrain: string
 * - morale: number
 * - onRoll: function(params) -> Promise(result)
 */
const CombatModal = ({ onClose, attackerUnits = [], defenderUnit, terrain = 'Clear', morale = 19, onRoll }) => {
    // Local State for Modifiers and Lead Unit
    const [support, setSupport] = useState({ artillery: 0, engineer: 0, air_support: false });
    const [calculatedStats, setCalculatedStats] = useState({ av: 0, dv: 0, logs: [] });
    const [result, setResult] = useState(null);
    const [isRolling, setIsRolling] = useState(false);

    // Determine initial lead ID (props based)
    const [selectedLeadId, setSelectedLeadId] = useState(null);

    useEffect(() => {
        // Initialize lead if not set
        if (!selectedLeadId && attackerUnits.length > 0) {
            const propsLead = attackerUnits.find(u => u.is_lead);
            setSelectedLeadId(propsLead ? propsLead.id : attackerUnits[0].id);
        }
    }, [attackerUnits]);

    // Initial Calculation Effect
    useEffect(() => {
        // In real app, this calls API. Here we mock calculate logic or call parent provided calculator.
        // For mock, we simply simulate logic or use a helper.
        recalculate();
    }, [support, attackerUnits, defenderUnit, selectedLeadId]);

    const recalculate = async () => {
        // Mock Calculation Logic (Client side for Mock UI responsiveness)
        // AV
        let av = 0;

        // Use selected lead
        const lead = attackerUnits.find(u => u.id === selectedLeadId) || attackerUnits[0];

        if (lead) av += (lead.attack_factor || 0);

        // Count additional units (ignoring HQ unless lead? Simplified: Count - 1)
        av += Math.max(0, attackerUnits.length - 1);

        av += support.artillery * 1;
        av += support.engineer * 2;

        // Combined Arms (Mock)
        const hasTank = attackerUnits.some(u => u.type === 'Tank');
        const hasInf = attackerUnits.some(u => u.type === 'Infantry');
        if (hasTank && hasInf && (support.artillery > 0 || support.engineer > 0)) av += 1;

        if (morale >= 10) av += 1;

        // DV
        let dv = defenderUnit ? (defenderUnit.defense_factor || 0) : 3;
        if (terrain === 'Urban') dv += 3;
        if (terrain === 'Fort') dv += 4;
        if (terrain === 'Clear') dv += 2;

        setCalculatedStats({ av, dv, logs: [`Lead Unit: ${lead ? lead.name : 'None'}`, "Calculated based on selection..."] });
    };

    const handleRoll = async () => {
        setIsRolling(true);
        setResult(null);

        // Simulate API delay
        setTimeout(async () => {
            // Mock Result
            if (onRoll) {
                // If parent provided roller (connecting to backend mock)
                const res = await onRoll({ ...support, leadUnitId: selectedLeadId });
                setResult(res);
            } else {
                // Fallback Mock result
                const d1 = Math.ceil(Math.random() * 6);
                const d2 = Math.ceil(Math.random() * 6);
                const at_total = calculatedStats.av + d1 + d2;

                const d3 = Math.ceil(Math.random() * 6);
                const d4 = Math.ceil(Math.random() * 6);
                const dt_total = calculatedStats.dv + d3 + d4;

                setResult({
                    at_roll: d1 + d2, dt_roll: d3 + d4,
                    at_total, dt_total,
                    is_success: at_total > dt_total,
                    logs: [
                        `US Attack Roll: ${d1}+${d2} = ${d1 + d2}`,
                        `JP Defense Roll: ${d3}+${d4} = ${d3 + d4}`,
                        at_total > dt_total ? "Result: SUCCESS (JP Eliminated)" : "Result: FAILED"
                    ]
                });
            }
            setIsRolling(false);
        }, 1000);
    };

    return (
        <div className="combat-overlay">
            <div className="combat-window">
                {/* Header */}
                <div className="combat-header">
                    <div className="combat-title">Combat Phase</div>
                    <button className="combat-close" onClick={onClose}>×</button>
                </div>

                <div className="combat-body">
                    {/* Attacker Section */}
                    <div className="combat-section attacker-section">
                        <div className="section-title">US Forces (Attacker) - Click to Select Lead</div>

                        <div className="unit-list">
                            {attackerUnits.map((u, i) => (
                                <div
                                    key={i}
                                    className={`unit-card ${u.id === selectedLeadId ? 'lead' : ''} ${u.type === 'Tank' ? 'armor' : ''}`}
                                    onClick={() => setSelectedLeadId(u.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="unit-card-icon">{u.type === 'Tank' ? 'Tk' : u.type === 'Leader' ? 'HQ' : 'Inf'}</div>
                                    <div className="unit-info">
                                        <div className="unit-name">{u.name}</div>
                                        <div className="unit-stats">AF: {u.attack_factor || '-'} {u.id === selectedLeadId ? '(Lead)' : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="section-title">Support & Mods</div>
                        <div className="modifiers-grid">
                            <button
                                className={`mod-btn ${support.artillery > 0 ? 'active' : ''}`}
                                onClick={() => setSupport(p => ({ ...p, artillery: (p.artillery + 1) % 3 }))}
                            >
                                <span>Artillery</span>
                                <span>x{support.artillery}</span>
                            </button>
                            <button
                                className={`mod-btn ${support.engineer > 0 ? 'active' : ''}`}
                                onClick={() => setSupport(p => ({ ...p, engineer: (p.engineer + 1) % 2 }))}
                            >
                                <span>Engineer</span>
                                <span>x{support.engineer}</span>
                            </button>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: 5 }}>Morale: {morale} (Strong)</div>

                        <div className="stats-display">
                            <div className="stat-label">Total Attack Value</div>
                            <div className="stat-value">{calculatedStats.av}</div>
                        </div>
                    </div>

                    {/* Center Action */}
                    <div className="action-section">
                        <div className="vs-badge">VS</div>
                        <button className="roll-btn" onClick={handleRoll} disabled={isRolling}>
                            {isRolling ? '...' : 'ROLL'}
                            {!isRolling && <span>DICE</span>}
                        </button>
                    </div>

                    {/* Defender Section */}
                    <div className="combat-section defender-section">
                        <div className="section-title">JP Forces (Defender)</div>
                        <div className="terrain-badge urban">{terrain} (+3)</div>

                        <div className="unit-list">
                            {defenderUnit ? (
                                <div className="unit-card">
                                    <div className="unit-card-icon" style={{ background: '#c53030' }}>JP</div>
                                    <div className="unit-info">
                                        <div className="unit-name">{defenderUnit.name}</div>
                                        <div className="unit-stats">DF: {defenderUnit.defense_factor}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="unit-card">Unknown Unit (???)</div>
                            )}
                        </div>

                        <div className="section-title">JP Modifiers</div>
                        <div className="modifiers-grid">
                            <button
                                className={`mod-btn ${support.air_support ? 'active' : ''}`}
                                onClick={() => setSupport(p => ({ ...p, air_support: !p.air_support }))}
                            >
                                <span>Air Support (Debuff)</span>
                                <span>{support.air_support ? 'ON' : 'OFF'}</span>
                            </button>
                        </div>

                        <div className="stats-display">
                            <div className="stat-label">Total Defense Value</div>
                            <div className="stat-value">{calculatedStats.dv}</div>
                        </div>
                    </div>
                </div>

                {/* Footer / Logs */}
                <div className="combat-footer">
                    <div className="section-title">Combat Log</div>
                    {result ? (
                        <>
                            {result.logs.map((l, i) => (
                                <div key={i} className={`log-message ${l.includes('Result') ? 'result' : ''}`}>{l}</div>
                            ))}
                        </>
                    ) : (
                        <div className="log-message">Ready to roll...</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CombatModal;
