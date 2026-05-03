/**
 * Turn phase logic: Dawn, Supply, Bloody Streets, End of Combat.
 */

const d6 = () => Math.floor(Math.random() * 6) + 1;

// ── Dawn Phase ────────────────────────────────────────────

export function processDawnPhase({ currentTurn, units, morale }) {
    const logs = [`--- 夜明けフェーズ (ターン ${currentTurn}) ---`];
    let updatedUnits = [];

    for (const unit of units) {
        const { id, status = 'fresh', name = '' } = unit;

        // Reinforcements
        if (status === 'future') {
            if (currentTurn === 2 && (id.includes('11-') || name.includes('11th'))) {
                logs.push(`増援到着: ${name} (第11空挺師団)`);
                updatedUnits.push({ ...unit, status: 'arriving' });
            } else if (currentTurn === 6 && (id.includes('754') || name.includes('754'))) {
                logs.push(`増援到着: ${name} (第754戦車大隊)`);
                updatedUnits.push({ ...unit, status: 'arriving' });
            } else {
                updatedUnits.push(unit);
            }
            continue;
        }

        // Leader casualty checks
        const isLeader = /HQ|Gen|Haugen|Beightler|Chase|Griswold|Swing|Struble|Hoffman|Fredrick|Whitcomb|White|Soule|Hildebrand/i.test(name + id) || unit.type === 'Leader';
        if (isLeader) {
            if (status === 'out_of_action') {
                if (currentTurn === 1) {
                    updatedUnits.push(unit);
                    continue;
                }
                const roll = d6();
                logs.push(`指揮官損害チェック: ${name} (ダイス ${roll})`);
                if (roll <= 2) {
                    logs.push('  -> 結果: 戦死。ゲームから除去。');
                    // omit unit (eliminated)
                } else if (roll <= 4) {
                    logs.push('  -> 結果: 負傷。次ターンに復帰。');
                    updatedUnits.push({ ...unit, status: 'wounded' });
                } else {
                    logs.push('  -> 結果: 軽傷。即時復帰！');
                    updatedUnits.push({ ...unit, status: 'fresh' });
                }
            } else if (status === 'wounded') {
                logs.push(`負傷指揮官 ${name} が復帰。`);
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
            logs.push(`撤退命令: ${unit.name} (${unit.id}) が撤退。`);
            if (unit.status === 'out_of_action') {
                morale -= 1;
                logs.push(`  -> ペナルティ！部隊が行動不能のまま撤退。士気 -1 (現在 ${morale})。`);
            }
            return false;
        });
    }

    return { units: updatedUnits, morale, logs };
}

// ── Supply Phase ──────────────────────────────────────────

export function processSupplyRoll({ currentTurn, currentSupply, currentEvent }) {
    const offensiveActive = ['Kembu Group Offensive', 'Shimbu Group Offensive'].includes(currentEvent?.name);
    const numDice = offensiveActive ? 2 : 4;
    const rolls = Array.from({ length: numDice }, d6);
    const totalRoll = rolls.reduce((a, b) => a + b, 0);
    const logs = offensiveActive
        ? [`イベント効果（${currentEvent.ja_name}）: 補給ダイス 4d6 → 2d6`]
        : [];
    logs.push(`補給ダイス (${numDice}d6): ${rolls.join('+')} = ${totalRoll}`);

    let added = totalRoll;
    if (currentTurn === 1 && totalRoll < 12) {
        added = 12;
        logs.push(`ターン1最低補給ルール適用: ${totalRoll} -> 12`);
    }

    const newTotal = currentSupply + added;
    logs.push(`補給ポイント: ${currentSupply} + ${added} = ${newTotal}`);

    return { roll: totalRoll, added, new_total: newTotal, logs };
}

// ── Bloody Streets ────────────────────────────────────────

// effect types: 'none' | 'ooa' | 'morale' | 'spent_all'
export function processBloodyStreetsCheck({ areaData }) {
    const ooa_queue = [];   // requires player selection
    const auto = [];        // applied immediately by caller
    const logs = [];

    for (const area of areaData) {
        const { terrain, us_count = 0, jp_count = 0, is_elite = false, us_unit_ids = [] } = area;
        if (!['Urban', 'Fort'].includes(terrain) || us_count === 0 || jp_count === 0) continue;

        const rawRoll = d6();
        const roll = Math.min(6, rawRoll + (is_elite ? 1 : 0));
        const eliteMark = is_elite ? ` (+1 精鋭修正、素値${rawRoll})` : '';

        if (roll <= 3) {
            logs.push(`流血の街路 - ${area.name}: ダイス${roll}${eliteMark} → 効果なし`);
        } else if (roll === 4) {
            logs.push(`流血の街路 - ${area.name}: ダイス${roll}${eliteMark} → 米軍ユニット1個をOOAへ`);
            ooa_queue.push({ area: area.name, roll, effect: 'ooa', morale_penalty: 0 });
        } else if (roll === 5) {
            logs.push(`流血の街路 - ${area.name}: ダイス${roll}${eliteMark} → 士気 -1`);
            auto.push({ area: area.name, roll, effect: 'morale', morale_penalty: 1, us_unit_ids });
        } else {
            logs.push(`流血の街路 - ${area.name}: ダイス${roll}${eliteMark} → 全米軍ユニット消耗 + 士気 -1`);
            auto.push({ area: area.name, roll, effect: 'spent_all', morale_penalty: 1, us_unit_ids });
        }
    }

    if (logs.length === 0) logs.push('流血の街路: 該当エリアなし。');
    return { ooa_queue, auto, logs };
}

// ── End of Combat Phase ───────────────────────────────────

export function processEndCombatPhase({ units, morale }) {
    const logs = ['--- 戦闘フェーズ終了 ---'];
    let flipCount = 0;

    const updatedUnits = units.map(u => {
        if (u.status === 'spent') {
            flipCount++;
            return { ...u, status: 'fresh' };
        }
        return u;
    });

    logs.push(`消耗 ${flipCount} 部隊を新鮮に回復。`);
    const newMorale = morale - 1;
    logs.push(`士気チェック: ${morale} -> ${newMorale} (-1 フェーズ終了)`);

    return { units: updatedUnits, morale: newMorale, logs };
}
