/**
 * Random Event Phase logic (Rule 6.2).
 */

const d6 = () => Math.floor(Math.random() * 6) + 1;

const EVENT_TABLE = [
    {
        total: 3,
        name: 'Kembu Group Breakout',
        ja_name: '剣武集団・突破作戦',
        type: 'Japanese Attack',
        target: null,
        effect_desc: '日本軍剣武集団が突破を敢行。米軍攻撃部隊の先導ユニット1部隊が行動不能（OOA）になる。',
    },
    {
        total: 4,
        name: 'Kembu Group Offensive',
        ja_name: '剣武集団・攻勢',
        type: 'Japanese Offensive',
        target: null,
        effect_desc: '剣武集団が組織的反撃を実施。OOA状態の第44戦車大隊のシャーマン1両につき士気-1。',
    },
    {
        total: [5, 6],
        name: '1st Cavalry Division Pause',
        ja_name: '第1騎兵師団・行動停止',
        type: 'Pause',
        target: '1C',
        effect_desc: '補給・再編のため第1騎兵師団が一時停止。同師団の全ユニットがこのターン消耗状態となり行動不能。',
    },
    {
        total: [7, 8],
        name: '37th Infantry Division Pause',
        ja_name: '第37歩兵師団・行動停止',
        type: 'Pause',
        target: '37',
        effect_desc: '補給・再編のため第37歩兵師団が一時停止。同師団の全ユニットがこのターン消耗状態となり行動不能。',
    },
    {
        total: [9, 10, 11, 12],
        name: 'Civilians and Refugees',
        ja_name: '市民と避難民',
        type: 'Mandatory Attack Priority',
        target: null,
        effect_desc: '市街地に多数の市民・難民が滞留。強制攻撃を実施する場合、攻撃値に-1のペナルティが適用される。',
    },
    {
        total: [13, 14],
        name: '11th Airborne Division Pause',
        ja_name: '第11空挺師団・行動停止',
        type: 'Pause',
        target: '11',
        effect_desc: '補給・再編のため第11空挺師団が一時停止。同師団の全ユニットがこのターン消耗状態となり行動不能。',
    },
    {
        total: [15, 16],
        name: 'Iwabuchi Orders Breakout',
        ja_name: '岩淵提督・突破命令',
        type: 'Japanese Attack',
        target: null,
        effect_desc: '岩淵三次提督が守備隊に突破を命令。米軍が都市・要塞エリアを支配していない場合は無効。該当する場合、米軍ユニット1部隊が行動不能（OOA）になる。',
    },
    {
        total: 17,
        name: 'Shimbu Group Offensive',
        ja_name: '振武集団・攻勢',
        type: 'Japanese Offensive',
        target: null,
        effect_desc: '振武集団が組織的反撃を実施。OOA状態の第44戦車大隊のシャーマン1両につき士気-1。',
    },
    {
        total: 18,
        name: 'Shimbu Group Breakout',
        ja_name: '振武集団・突破作戦',
        type: 'Japanese Attack',
        target: null,
        effect_desc: '日本軍振武集団が全力で突破を敢行。米軍攻撃部隊の先導ユニット1部隊が行動不能（OOA）になる。',
    },
];

const NO_RESULT = {
    name: 'No Result',
    ja_name: 'イベントなし',
    type: 'No Result',
    target: null,
    effect_desc: 'このターンは特記すべきイベントなし。通常通り行動フェーズへ進む。',
};

function lookupEvent(total) {
    for (const row of EVENT_TABLE) {
        const t = row.total;
        if (Array.isArray(t) ? t.includes(total) : t === total) {
            return { name: row.name, ja_name: row.ja_name, type: row.type, target: row.target, effect_desc: row.effect_desc };
        }
    }
    return { ...NO_RESULT };
}

export function processRandomEvent({ currentTurn, lastEvent, usControlledTags }) {
    const logs = [`--- ランダムイベント・フェーズ (ターン ${currentTurn}) ---`];

    const rolls = [d6(), d6(), d6()];
    const total = rolls.reduce((a, b) => a + b, 0);
    logs.push(`3d6: ${rolls.join('+')} = ${total}`);

    let event = lookupEvent(total);
    logs.push(`初期結果: ${event.ja_name}`);

    // Pause events invalid on Turn 1 and 9
    if (event.type === 'Pause' && (currentTurn === 1 || currentTurn === 9)) {
        logs.push(`ルール 6.2.1: ターン ${currentTurn} は行動停止イベント無効 → イベントなし`);
        event = { ...NO_RESULT };
    }

    // Consecutive pause for same division → No Result
    if (event.type === 'Pause' && lastEvent?.type === 'Pause' && lastEvent?.target === event.target) {
        logs.push(`ルール 6.2.1: 同師団の行動停止が連続 → イベントなし`);
        event = { ...NO_RESULT };
    }

    // Iwabuchi Breakout requires US to control Urban or Fort
    if (event.name === 'Iwabuchi Orders Breakout') {
        if (!usControlledTags.includes('Urban') && !usControlledTags.includes('Fort')) {
            logs.push('ルール 6.2.1: 米軍が都市・要塞エリアを支配していないため無効 → イベントなし');
            event = { ...NO_RESULT };
        } else {
            const subRoll = d6();
            const active = subRoll >= 5;
            event = { ...event, iwabuchiRoll: subRoll, iwabuchiActive: active };
            logs.push(`岩淵提督・突破命令！ダイス: ${subRoll} → ${active ? '発動！対象エリア選択待ち...' : '効果なし'}`);
        }
    }

    if (['Kembu Group Offensive', 'Shimbu Group Offensive'].includes(event.name)) {
        logs.push(`攻勢効果: このターンの補給ダイスが 4d6 → 2d6 に減少`);
    }

    return {
        event: { name: event.name, ja_name: event.ja_name, type: event.type, target: event.target, effect_desc: event.effect_desc, roll: total, rolls },
        logs,
    };
}
