import { unitLabel } from './unitNames.js';

/**
 * Combat dice resolution and state application.
 */

const d6 = () => Math.floor(Math.random() * 6) + 1;

const RESULT_JA = {
    Success:          '成功',
    Repulse:          '撃退',
    Stalemate:        '膠着',
    Overrun:          '突破',
    StrategyCasualty: '防衛戦略損害',
};

/**
 * Roll dice and determine raw combat outcome.
 * Returns result data; caller decides resultType label.
 */
export function resolveCombat({
    attackValue,
    defenseValue,
    baseDefenseValue = null,
    terrainMod = null,
    isElite = false,
    hasAirSupport = false,
    terrainType = null,
}) {
    const logs = ['戦闘解決:'];

    const [d1, d2] = [d6(), d6()];
    const atRoll  = d1 + d2;
    const atTotal = attackValue + atRoll;
    logs.push(`  米軍攻撃: 攻撃値 ${attackValue} + ダイス ${atRoll} (${d1}+${d2}) = ${atTotal}`);

    let airReduction = 0;
    if (hasAirSupport) {
        airReduction = d6();
        logs.push(`  航空支援: 防御値を ${airReduction} 減少 (1d6)`);
    }

    let dtRoll;
    if (isElite) {
        const rolls = [d6(), d6(), d6()].sort((a, b) => a - b);
        dtRoll = rolls[1] + rolls[2];
        logs.push(`  日本軍精鋭防御: ダイス [${rolls}] -> ${rolls[0]} 除外 -> [${rolls[1]}, ${rolls[2]}] 採用 = ${dtRoll}`);
    } else {
        const [d3, d4] = [d6(), d6()];
        dtRoll = d3 + d4;
        logs.push(`  日本軍防御ダイス: ${dtRoll} (${d3}+${d4})`);
    }

    const finalDv = Math.max(0, defenseValue - airReduction);
    const dtTotal = finalDv + dtRoll;

    const base  = baseDefenseValue ?? defenseValue;
    const tMod  = terrainMod ?? 0;
    const tLabel = terrainType ?? '';
    if (hasAirSupport && airReduction > 0) {
        logs.push(`  日本軍防御合計: 基本値 ${base} + 地形 ${tMod}(${tLabel}) - 航空 ${airReduction} + ダイス ${dtRoll} = ${dtTotal}`);
    } else {
        logs.push(`  日本軍防御合計: 基本値 ${base} + 地形 ${tMod}(${tLabel}) + ダイス ${dtRoll} = ${dtTotal}`);
    }

    const diff      = atTotal - dtTotal;
    const isSuccess = diff > 0;
    let   isOverrun = false;

    if (isSuccess) {
        if (diff > defenseValue && terrainType !== 'Fort') {
            isOverrun = true;
            logs.push(`  結果: 突破！(差分 ${diff} > 基本防御値 ${defenseValue})`);
        } else {
            if (terrainType === 'Fort' && diff > defenseValue) {
                logs.push('  結果: 成功 (日本軍除去) - 要塞地形により突破阻止 (ルール 11.7)');
            } else {
                logs.push('  結果: 成功 (日本軍除去)');
            }
        }
    } else {
        logs.push('  結果: 失敗 (膠着/撃退)');
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
            logs.push(`防衛戦略による損害 (攻撃側): ${unitLabel(byId[cid])} -> 行動不能`);
        }
        if (updatedDefender?.id === cid) {
            updatedDefender.status   = 'out_of_action';
            updatedDefender.location = 'OOA';
            logs.push(`防衛戦略による損害 (防衛側): ${unitLabel(updatedDefender)} -> 行動不能`);
        }
    }

    const leadUnit = Object.values(byId).find(u => u.is_lead && u.status !== 'out_of_action') ?? null;
    logs.push(`戦闘結果適用: ${RESULT_JA[resultType] ?? resultType}`);

    if (resultType === 'StrategyCasualty') {
        logs.push('  -> 防衛戦略損害を即時適用。');
        return result(byId, updatedDefender, newMorale, areaUpdate, logs);
    }

    if (resultType === 'Repulse') {
        if (leadUnit) {
            leadUnit.status   = 'out_of_action';
            leadUnit.location = 'OOA';
            logs.push(`  先導部隊 ${unitLabel(leadUnit)} -> 行動不能`);
        }
        for (const u of Object.values(byId)) {
            if (leadUnit && u.id === leadUnit.id) continue;
            if (u.status !== 'out_of_action') {
                u.status = 'spent';
                logs.push(`  部隊 ${unitLabel(u)} -> 消耗`);
            }
        }
        revealDefender(updatedDefender, logs);
        newMorale -= 1;
        logs.push(`  士気: ${currentMorale} -> ${newMorale} (-1)`);

    } else if (resultType === 'Stalemate') {
        for (const u of Object.values(byId)) {
            if (u.status !== 'out_of_action') u.status = 'spent';
        }
        logs.push('  全攻撃部隊 -> 消耗');
        revealDefender(updatedDefender, logs);

    } else if (resultType === 'Success') {
        eliminateDefender(updatedDefender, logs);
        for (const u of Object.values(byId)) {
            if (u.status !== 'out_of_action') u.status = 'spent';
        }
        logs.push('  全攻撃部隊 -> 消耗');
        areaUpdate = { control: 'US' };
        logs.push(`  ${targetArea} -> 米軍支配`);

    } else if (resultType === 'Overrun') {
        eliminateDefender(updatedDefender, logs);
        logs.push('  突破！全攻撃部隊は消耗しない。');
        areaUpdate = { control: 'US' };
        logs.push(`  ${targetArea} -> 米軍支配`);
    }

    return result(byId, updatedDefender, newMorale, areaUpdate, logs);
}

// ── helpers ───────────────────────────────────────────────

function revealDefender(defender, logs) {
    if (defender && defender.status !== 'eliminated') {
        defender.status = 'revealed';
        logs.push(`  防衛部隊判明: ${unitLabel(defender)}`);
    }
}

function eliminateDefender(defender, logs) {
    if (defender) {
        defender.status   = 'eliminated';
        defender.location = 'Eliminated';
        logs.push(`  防衛部隊 ${unitLabel(defender)} -> 除去`);
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
