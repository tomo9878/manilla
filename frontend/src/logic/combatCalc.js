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
    if (!leadUnit) return { av: 0, dv: 0, logs: ['No attacking units'] };

    const baseAv = leadUnit.attack_factor ?? 2;
    av += baseAv;
    logs.push(`AV Base (Lead ${leadUnit.name}): ${baseAv}`);

    const additionalCount = attackerUnits.length - 1;
    if (additionalCount > 0) {
        av += additionalCount;
        logs.push(`AV Additional Units (+${additionalCount}): Total ${attackerUnits.length} units`);
    }

    const artyCount = supportModifiers.artillery ?? 0;
    const engCount  = supportModifiers.engineer  ?? 0;
    const totalSupport = artyCount + engCount;

    av += artyCount + engCount * 2;
    if (totalSupport > 0) {
        logs.push(`AV Support: Arty x${artyCount} (+${artyCount}), Eng x${engCount} (+${engCount * 2})`);
    }

    // Combined Arms (Tank + Infantry + Support)
    const hasTank = attackerUnits.some(u => ['Armor', 'Tank'].includes(u.type));
    const hasInf  = attackerUnits.some(u => ['Infantry', 'infantry'].includes(u.type));
    if (hasTank && hasInf && totalSupport > 0) {
        if (['Urban', 'Fort'].includes(terrainType)) {
            if (engCount > 0) {
                av += 1;
                logs.push('AV Combined Arms Bonus (Rubble/Eng): +1');
            } else {
                logs.push('No Combined Arms Bonus: Urban/Fort requires Engineer support.');
            }
        } else {
            av += 1;
            logs.push('AV Combined Arms Bonus: +1');
        }
    }

    if (morale >= 10) {
        av += 1;
        logs.push(`AV Strong Morale (${morale}): +1`);
    }

    if (eventCiviActive && isMandatoryAttack) {
        av -= 1;
        logs.push('AV Penalty (Civilians & Mandatory): -1');
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
        logs.push(`AV Parent Formation Penalty: ${penalty} (Mixed ${[...formations].join(', ')})`);
    }

    // ── DV ────────────────────────────────────────────────
    const baseDf = defenderUnit ? (defenderUnit.defense_factor ?? 3) : 3;
    dv += baseDf;
    logs.push(`DV Base (${defenderUnit?.name ?? '??'}): ${baseDf}`);

    const terrainBonus = { Urban: 3, Fort: 4, Clear: 2 };
    const tMod = terrainBonus[terrainType] ?? 0;
    dv += tMod;
    logs.push(`DV Terrain (${terrainType}): +${tMod}`);

    if (morale <= 9) {
        dv += 1;
        logs.push(`DV Shaken Bonus (US Morale ${morale}): +1`);
    }

    if (supportModifiers.air_support) {
        logs.push('DV Air Support: Will reduce DV by 1d6 during resolution');
    }
    if (defenderUnit?.is_elite) {
        logs.push('DV Elite: Will roll 3d6 (drop lowest) for Defense');
    }

    return { av, dv, logs };
}
