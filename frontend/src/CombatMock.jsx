
import React, { useState } from 'react';
import CombatModal from './components/CombatModal';

const CombatMock = () => {
    const [showModal, setShowModal] = useState(true);

    // Mock Data based on User Scenario
    const attackerUnits = [
        { id: "u1", name: "637/A", type: "Tank", attack_factor: 6, is_lead: true },
        { id: "u2", name: "1/145", type: "Infantry", attack_factor: 4 },
        { id: "u3", name: "HQ Whitcomb", type: "Leader", attack_factor: 0 }
    ];

    const defenderUnit = {
        name: "JP Urban 7",
        strength: 7,
        unitClass: "Ambush", // Test Ambush effect
        defense_factor: 7
    };

    const handleApply = (result) => {
        console.log("Mock Apply Result:", result);
        alert(`Applied Result: ${result.resultType}\nMorale: ${result.currentMorale}\nSee console for details.`);
        setShowModal(false);
    };

    return (
        <div style={{ padding: 20, background: '#1a202c', minHeight: '100vh', color: 'white' }}>
            <h1>Combat Mock Preview</h1>
            <p>Scenario: US Tank Lead vs JP Ambush Unit in Urban.</p>
            <button
                onClick={() => setShowModal(true)}
                style={{
                    padding: '10px 20px',
                    background: '#4299e1',
                    border: 'none',
                    borderRadius: 4,
                    color: 'white',
                    cursor: 'pointer'
                }}
            >
                Open Combat Window
            </button>

            {showModal && (
                <CombatModal
                    onClose={() => setShowModal(false)}
                    onApply={handleApply}
                    attackerUnits={attackerUnits}
                    defenderUnit={defenderUnit}
                    terrain="Urban"
                    morale={19}
                />
            )}
        </div>
    );
};

export default CombatMock;
