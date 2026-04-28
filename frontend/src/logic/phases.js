/**
 * Turn phase logic: Dawn, Supply, Bloody Streets, End of Combat.
 */

const d6 = () => Math.floor(Math.random() * 6) + 1;

// ── Dawn Phase ────────────────────────────────────────────

export function processDawnPhase({ currentTurn, units, morale }) {
    const logs = [`--- Dawn Phase (Turn ${currentTurn}) ---`];
    let updatedUnits = [];

    for (const unit of units) {
        const { id, status = 'fresh', name = '' } = unit;

        // Reinforcements
        if (status === 'future') {
            if (currentTurn === 2 && (id.includes('11-') || name.includes('11th'))) {
                logs.push(`Reinforcement Arrived: ${name} (11th Airborne)`);
                updatedUnits.push({ ...unit, status: 'arriving' });
            } else if (currentTurn === 6 && (id.includes('754') || name.includes('754'))) {
                logs.push(`Reinforcement Arrived: ${name} (754th Tank)`);
                updatedUnits.push({ ...unit, status: 'arriving' });
            } else {
                updatedUnits.push(unit);
            }
            continue;
        }

        // Leader casualty checks
        const isLeader = /HQ|Gen|Haugen|Beightler|Chase|Griswold|Swing|Struble/i.test(name + id);
        if (isLeader) {
            if (status === 'out_of_action') {
                if (currentTurn === 1) {
                    updatedUnits.push(unit);
                    continue;
                }
                const roll = d6();
                logs.push(`Leader Casualty Check: ${name} (Rolled ${roll})`);
                if (roll <= 2) {
                    logs.push('  -> Result: KIA. Removed from game.');
                    // omit unit (eliminated)
                } else if (roll <= 4) {
                    logs.push('  -> Result: Wounded. Returns next Turn.');
                    updatedUnits.push({ ...unit, status: 'wounded' });
                } else {
                    logs.push('  -> Result: Superficial. Returns immediately!');
                    updatedUnits.push({ ...unit, status: 'fresh' });
                }
            } else if (status === 'wounded') {
                logs.push(`Wounded Leader ${name} returns to duty.`);
                updatedUnits.push({ ...unit, status: 'fresh' });
            } else {
                updatedUnits.push(unit);
            }
        } else {
            updatedUnits.push(unit);
        }
    }

    // Turn 6: withdraw 44th Tank Battalion
    if (currentTurn === 6) {
        const withdrawIds = new Set(['1C_44A', '1C_44B', '1C_44D']);
        updatedUnits = updatedUnits.filter(unit => {
            if (!withdrawIds.has(unit.id)) return true;
            logs.push(`Withdrawal: ${unit.name} (${unit.id}) ordered to withdraw.`);
            if (unit.status === 'out_of_action') {
                morale -= 1;
                logs.push(`  -> Penalty! Unit was OOA. Morale -1 (Now ${morale}).`);
            }
            return false;
        });
    }

    return { units: updatedUnits, morale, logs };
}

// ── Supply Phase ──────────────────────────────────────────

export function processSupplyRoll({ currentTurn, currentSupply }) {
    const rolls = [d6(), d6(), d6(), d6()];
    const totalRoll = rolls.reduce((a, b) => a + b, 0);
    const logs = [`Supply Roll (4d6): ${rolls.join('+')} = ${totalRoll}`];

    let added = totalRoll;
    if (currentTurn === 1 && totalRoll < 12) {
        added = 12;
        logs.push(`Turn 1 Minimum Supply Rule applied: ${totalRoll} -> 12`);
    }

    const newTotal = currentSupply + added;
    logs.push(`Supply Points: ${currentSupply} + ${added} = ${newTotal}`);

    return { roll: totalRoll, added, new_total: newTotal, logs };
}

// ── Bloody Streets ────────────────────────────────────────

export function processBloodyStreetsCheck({ areaData }) {
    const results = [];
    const logs = ['Checking for Bloody Streets (Urban/Fort + Contested)...'];

    for (const area of areaData) {
        const { terrain, us_count = 0, jp_count = 0 } = area;
        if (!['Urban', 'Fort'].includes(terrain) || us_count === 0 || jp_count === 0) continue;

        const roll = d6();
        if (roll <= 2) {
            logs.push(`Bloody Streets in ${area.name}: Rolled ${roll} -> No Effect`);
        } else if (roll <= 4) {
            logs.push(`Bloody Streets in ${area.name}: Rolled ${roll} -> US takes 1 OOA!`);
            results.push({ area: area.name, roll, effect: 'OOA', required_ooa: 1, morale_penalty: 0 });
        } else {
            logs.push(`Bloody Streets in ${area.name}: Rolled ${roll} -> US takes 1 OOA and Morale -1!`);
            results.push({ area: area.name, roll, effect: 'OOA + Morale -1', required_ooa: 1, morale_penalty: 1 });
        }
    }

    if (results.length === 0) logs.push('No Bloody Streets casualties occurred.');
    return { results, logs };
}

// ── End of Combat Phase ───────────────────────────────────

export function processEndCombatPhase({ units, morale }) {
    const logs = ['--- End of Combat Phase ---'];
    let flipCount = 0;

    const updatedUnits = units.map(u => {
        if (u.status === 'spent') {
            flipCount++;
            return { ...u, status: 'fresh' };
        }
        return u;
    });

    logs.push(`Reset ${flipCount} Spent units to Fresh.`);
    const newMorale = morale - 1;
    logs.push(`Morale Check: ${morale} -> ${newMorale} (-1 for Phase End)`);

    return { units: updatedUnits, morale: newMorale, logs };
}
