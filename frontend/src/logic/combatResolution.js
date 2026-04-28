/**
 * Combat dice resolution and state application.
 */

const d6 = () => Math.floor(Math.random() * 6) + 1;

/**
 * Roll dice and determine raw combat outcome.
 * Returns result data; caller decides resultType label.
 */
export function resolveCombat({
    attackValue,
    defenseValue,
    isElite = false,
    hasAirSupport = false,
    terrainType = null,
}) {
    const logs = ['Combat Resolution:'];

    const [d1, d2] = [d6(), d6()];
    const atRoll  = d1 + d2;
    const atTotal = attackValue + atRoll;
    logs.push(`  US Attack: AV ${attackValue} + Roll ${atRoll} (${d1}+${d2}) = ${atTotal}`);

    let airReduction = 0;
    if (hasAirSupport) {
        airReduction = d6();
        logs.push(`  Air Support: DV Reduced by ${airReduction} (Roll 1d6)`);
    }

    let dtRoll;
    if (isElite) {
        const rolls = [d6(), d6(), d6()].sort((a, b) => a - b);
        dtRoll = rolls[1] + rolls[2];
        logs.push(`  JP Elite Defense: Rolls [${rolls}] -> Drop ${rolls[0]} -> Keep [${rolls[1]}, ${rolls[2]}] = ${dtRoll}`);
    } else {
        const [d3, d4] = [d6(), d6()];
        dtRoll = d3 + d4;
        logs.push(`  JP Defense Roll: ${dtRoll} (${d3}+${d4})`);
    }

    const finalDv = Math.max(0, defenseValue - airReduction);
    const dtTotal = finalDv + dtRoll;
    logs.push(`  JP Defense Total: (Base ${defenseValue} - Air ${airReduction}) + Roll ${dtRoll} = ${dtTotal}`);

    const diff      = atTotal - dtTotal;
    const isSuccess = diff > 0;
    let   isOverrun = false;

    if (isSuccess) {
        if (diff > defenseValue && terrainType !== 'Fort') {
            isOverrun = true;
            logs.push(`  Result: OVERRUN! (Diff ${diff} > Base DF ${defenseValue})`);
        } else {
            if (terrainType === 'Fort' && diff > defenseValue) {
                logs.push('  Result: Success (JP Eliminated) - Overrun prevented by Fort terrain (Rule 11.7)');
            } else {
                logs.push('  Result: Success (JP Eliminated)');
            }
        }
    } else {
        logs.push('  Result: Failed (Stalemate/Repulse)');
    }

    return {
        at_roll: atRoll,
        dt_roll: dtRoll,
        at_total: atTotal,
        dt_total: dtTotal,
        diff,
        is_success: isSuccess,
        is_overrun: isOverrun,
        logs,
    };
}

/**
 * Apply a combat result to units and game state.
 * Returns updated copies — does not mutate inputs.
 */
export function applyCombatResult({
    resultType,
    attackerUnits,
    defenderUnit,
    targetArea,
    currentMorale,
    strategyCasualtyIds = [],
}) {
    const logs = [];
    const byId = Object.fromEntries(attackerUnits.map(u => [u.id, { ...u }]));
    let updatedDefender = defenderUnit ? { ...defenderUnit } : null;
    let newMorale  = currentMorale;
    let areaUpdate = {};

    // Pre-combat strategy casualties
    for (const cid of strategyCasualtyIds) {
        if (byId[cid]) {
            byId[cid].status   = 'out_of_action';
            byId[cid].location = 'OOA';
            logs.push(`Strategy Casualty (Attacker): ${byId[cid].name} (${cid}) -> OOA`);
        }
        if (updatedDefender?.id === cid) {
            updatedDefender.status   = 'out_of_action';
            updatedDefender.location = 'OOA';
            logs.push(`Strategy Casualty (Defender): ${updatedDefender.name} (${cid}) -> OOA`);
        }
    }

    const leadUnit = Object.values(byId).find(u => u.is_lead && u.status !== 'out_of_action') ?? null;
    logs.push(`Applying Combat Result: ${resultType}`);

    if (resultType === 'StrategyCasualty') {
        logs.push('  -> Strategy Casualties applied immediately.');
        return result(byId, updatedDefender, newMorale, areaUpdate, logs);
    }

    if (resultType === 'Repulse') {
        if (leadUnit) {
            leadUnit.status   = 'out_of_action';
            leadUnit.location = 'OOA';
            logs.push(`  Lead Unit ${leadUnit.name} -> OOA`);
        }
        for (const u of Object.values(byId)) {
            if (leadUnit && u.id === leadUnit.id) continue;
            if (u.status !== 'out_of_action') {
                u.status = 'spent';
                logs.push(`  Unit ${u.name} -> Spent`);
            }
        }
        revealDefender(updatedDefender, logs);
        newMorale -= 1;
        logs.push(`  Morale: ${currentMorale} -> ${newMorale} (-1)`);

    } else if (resultType === 'Stalemate') {
        for (const u of Object.values(byId)) {
            if (u.status !== 'out_of_action') u.status = 'spent';
        }
        logs.push('  All Attacking Units -> Spent');
        revealDefender(updatedDefender, logs);

    } else if (resultType === 'Success') {
        eliminateDefender(updatedDefender, logs);
        for (const u of Object.values(byId)) {
            if (u.status !== 'out_of_action') u.status = 'spent';
        }
        logs.push('  All Attacking Units -> Spent');
        areaUpdate = { control: 'US' };
        logs.push(`  Area ${targetArea} -> US Control`);

    } else if (resultType === 'Overrun') {
        eliminateDefender(updatedDefender, logs);
        logs.push('  Overrun! All Attacking Units remain Fresh.');
        areaUpdate = { control: 'US' };
        logs.push(`  Area ${targetArea} -> US Control`);
    }

    return result(byId, updatedDefender, newMorale, areaUpdate, logs);
}

// ── helpers ───────────────────────────────────────────────

function revealDefender(defender, logs) {
    if (defender && defender.status !== 'eliminated') {
        defender.status = 'revealed';
        logs.push(`  Defender Revealed: ${defender.name}`);
    }
}

function eliminateDefender(defender, logs) {
    if (defender) {
        defender.status   = 'eliminated';
        defender.location = 'Eliminated';
        logs.push(`  Defender ${defender.name} -> Eliminated`);
    }
}

function result(byId, defender, morale, areaUpdate, logs) {
    return {
        updated_attacker_units: Object.values(byId),
        updated_defender_unit:  defender,
        new_morale:  morale,
        area_update: areaUpdate,
        logs,
    };
}
