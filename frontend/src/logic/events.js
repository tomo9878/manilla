/**
 * Random Event Phase logic (Rule 6.2).
 */

const d6 = () => Math.floor(Math.random() * 6) + 1;

const EVENT_TABLE = [
    { total: 3,           name: 'Kembu Group Breakout',                    type: 'Japanese Attack',          target: null },
    { total: 4,           name: 'Kembu Group Offensive',                   type: 'Japanese Offensive',       target: null },
    { total: [5, 6],      name: '1st Cavalry Division Pause',              type: 'Pause',                    target: '1C'  },
    { total: [7, 8],      name: '37th Infantry Division Pause',            type: 'Pause',                    target: '37'  },
    { total: [9, 10, 11, 12], name: 'Civilians and Refugees',             type: 'Mandatory Attack Priority', target: null },
    { total: [13, 14],    name: '11th Airborne Division Pause',            type: 'Pause',                    target: '11'  },
    { total: [15, 16],    name: 'Iwabuchi Orders Breakout',                type: 'Japanese Attack',          target: null },
    { total: 17,          name: 'Shimbu Group Offensive',                  type: 'Japanese Offensive',       target: null },
    { total: 18,          name: 'Shimbu Group Breakout',                   type: 'Japanese Attack',          target: null },
];

function lookupEvent(total) {
    for (const row of EVENT_TABLE) {
        const t = row.total;
        if (Array.isArray(t) ? t.includes(total) : t === total) {
            return { name: row.name, type: row.type, target: row.target };
        }
    }
    return { name: 'No Result', type: 'No Result', target: null };
}

export function processRandomEvent({ currentTurn, lastEvent, usControlledTags, units, morale }) {
    const logs = [`--- Random Event Phase (Turn ${currentTurn}) ---`];

    const rolls = [d6(), d6(), d6()];
    const total = rolls.reduce((a, b) => a + b, 0);
    logs.push(`Rolled 3d6: ${rolls.join('+')} = ${total}`);

    let { name, type, target } = lookupEvent(total);
    logs.push(`Initial Result: ${name}`);

    // Pause events invalid on Turn 1 and 9
    if (type === 'Pause' && (currentTurn === 1 || currentTurn === 9)) {
        logs.push(`Rule 6.2.1: Pause events are treated as No Result on Turn ${currentTurn}.`);
        ({ name, type, target } = { name: 'No Result', type: 'No Result', target: null });
    }

    // Consecutive pause for same division → No Result
    if (type === 'Pause' && lastEvent?.type === 'Pause' && lastEvent?.target === target) {
        logs.push(`Rule 6.2.1: Consecutive Pause for ${target} -> No Result.`);
        ({ name, type, target } = { name: 'No Result', type: 'No Result', target: null });
    }

    // Iwabuchi Breakout requires US to control Urban or Fort
    if (name === 'Iwabuchi Orders Breakout') {
        if (!usControlledTags.includes('Urban') && !usControlledTags.includes('Fort')) {
            logs.push('Rule 6.2.1: US controls no Urban/Fort areas -> No Result.');
            ({ name, type, target } = { name: 'No Result', type: 'No Result', target: null });
        }
    }

    // Kembu/Shimbu Offensive: morale penalty for 44th Tank units in OOA
    if (['Kembu Group Offensive', 'Shimbu Group Offensive'].includes(name)) {
        const ooaCount = units.filter(u =>
            u.id.includes('44') && u.name.includes('Sherman') && u.status === 'out_of_action'
        ).length;
        if (ooaCount > 0) {
            morale -= ooaCount;
            logs.push(`Offensive Effect: ${ooaCount} x 44th Tank units in OOA. Morale -${ooaCount} (Now ${morale}).`);
        }
    }

    return {
        event: { name, type, target, roll: total },
        morale,
        logs,
    };
}
