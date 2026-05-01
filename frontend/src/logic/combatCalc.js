import { unitLabel } from './unitNames.js';

/**
 * Pre-combat AV/DV calculation.
 * Pure function — no dice, no side effects.
 */
export function calculateCombatStats({
    attackerUnits,
    supportModifiers,
    morale,
    terrainType,
    defenderUnit = null,
    isMandatoryAttack = false,
    eventCiviActive = false,
}) {
    const logs = [];
    let av = 0;
    let dv = 0;

    // ── AV ────────────────────────────────────────────────
    const leadUnit = attackerUnits.find(u => u.is_lead) ?? attackerUnits[0] ?? null;
    if (!leadUnit) return { av: 0, dv: 0, logs: ['攻撃部隊なし'] };

    const baseAv = leadUnit.attack_factor ?? 2;
    av += baseAv;
    logs.push(`攻撃値 基本値 (先導: ${unitLabel(leadUnit)}): ${baseAv}`);

    const additionalCount = attackerUnits.length - 1;
    if (additionalCount > 0) {
        av += additionalCount;
        logs.push(`攻撃値 追加部隊 (+${additionalCount}): 計 ${attackerUnits.length} 部隊`);
    }

    const artyCount = supportModifiers.artillery ?? 0;
    const engCount  = supportModifiers.engineer  ?? 0;
    const totalSupport = artyCount + engCount;

    av += artyCount + engCount * 2;
    if (totalSupport > 0) {
        logs.push(`攻撃値 支援: 砲兵 x${artyCount} (+${artyCount}), 工兵 x${engCount} (+${engCount * 2})`);
    }

    // Combined Arms (Tank + Infantry + Support)
    const hasTank = attackerUnits.some(u => ['Armor', 'Tank'].includes(u.type));
    const hasInf  = attackerUnits.some(u => ['Infantry', 'infantry'].includes(u.type));
    if (hasTank && hasInf && totalSupport > 0) {
        if (['Urban', 'Fort'].includes(terrainType)) {
            if (engCount > 0) {
                av += 1;
                logs.push('攻撃値 諸兵科連合ボーナス (廃墟/工兵): +1');
            } else {
                logs.push('諸兵科連合ボーナスなし: 市街地/要塞は工兵支援が必要');
            }
        } else {
            av += 1;
            logs.push('攻撃値 諸兵科連合ボーナス: +1');
        }
    }

    if (morale >= 10) {
        av += 1;
        logs.push(`攻撃値 高士気 (${morale}): +1`);
    }

    if (eventCiviActive && isMandatoryAttack) {
        av -= 1;
        logs.push('攻撃値 ペナルティ (市民 & 強制攻撃): -1');
    }

    // Mixed formation penalty (-1 per extra formation beyond first)
    const formations = new Set();
    for (const u of attackerUnits) {
        const id = u.id ?? '';
        if (id.startsWith('37_'))     formations.add('37th');
        else if (id.startsWith('1C_')) formations.add('1st');
        else if (id.startsWith('11-')) formations.add('11th');
    }
    if (formations.size > 1) {
        const penalty = -(formations.size - 1);
        av += penalty;
        logs.push(`攻撃値 混成部隊ペナルティ: ${penalty} (混成: ${[...formations].join(', ')})`);
    }

    // ── DV ────────────────────────────────────────────────
    const baseDf = defenderUnit ? (defenderUnit.defense_factor ?? 3) : 3;
    dv += baseDf;

    const terrainBonus = { Urban: 3, Fort: 4, Clear: 2 };
    const tMod = terrainBonus[terrainType] ?? 0;
    dv += tMod;
    logs.push(`防御値: 基本値 ${baseDf} + 地形(${terrainType}) ${tMod} = ${baseDf + tMod}  [${unitLabel(defenderUnit)}]`);

    if (morale <= 9) {
        dv += 1;
        logs.push(`防御値 動揺ボーナス (米軍士気 ${morale}): +1 → 計 ${dv}`);
    }

    if (supportModifiers.air_support) {
        logs.push('防御値 航空支援: 解決時に1d6分防御値を減少');
    }
    if (defenderUnit?.is_elite) {
        logs.push('防御値 精鋭: 防御に3d6（最低値除外）を使用');
    }

    return { av, dv, logs };
}
