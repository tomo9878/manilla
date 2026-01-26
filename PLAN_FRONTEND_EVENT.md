# フロントエンド実装計画: ランダムイベントフェーズ (Turn Sequence Phase 2)

バックエンドの `/api/phase/event` 実装完了に伴い、フロントエンド (`App.jsx`) に必要な変更点をまとめました。

## 1. 状態管理 (State Management)

以下のState変数を追加・更新し、イベント結果を管理します。

```javascript
// 既存のPhase管理に加え、イベント情報を保持するStateを追加
const [currentEvent, setCurrentEvent] = useState(null); // { name, type, target, roll }
const [lastEvent, setLastEvent] = useState(null);       // 前ターンのイベント（連続Pause判定用）

// イベント履歴ログ（オプション：ユーザーに履歴を見せる場合）
const [eventLog, setEventLog] = useState([]);
```

## 2. API連携フロー (API Logic)

### リクエストデータの準備
API呼び出し時に `usControlledTags` (例: `['Urban', 'Fort']`) を計算して渡す必要があります。これは「岩淵の脱出」イベントの発生条件チェックに使用されます。

```javascript
// 「US支配エリア」のリストから、そのエリアの「地形タイプ」を抽出するロジック
const getUsControlledTags = () => {
    // mapData: 全エリア情報（terrainプロパティを含む）
    // usControlledAreas: USが支配しているエリア名の配列
    const tags = new Set();
    usControlledAreas.forEach(name => {
        const area = mapData.find(a => a.name === name);
        if (area && area.terrain) {
            tags.add(area.terrain); // "Urban", "Fort", "Clear" 等
        }
    });
    return Array.from(tags);
};
```

### ハンドラ関数: `handleEventPhase`
「イベントダイスを振る」ボタン押下時の処理です。

```javascript
const handleEventPhase = async () => {
    try {
        const tags = getUsControlledTags();
        const res = await fetch('/api/phase/event', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
                 currentTurn: turn, 
                 units: units, 
                 morale: morale,
                 lastEvent: lastEvent, // 前回の結果を渡す
                 usControlledTags: tags
             })
        });
        
        const data = await res.json();
        
        // 1. 結果の保存と表示
        setCurrentEvent(data.event);
        setLastEvent(data.event); // 次ターンのために更新（No Resultでも更新してOKかは要検討、通常は有効なPauseのみ追跡だが、ルール上「同じ結果」を見るならそのまま更新）
        
        // 2. モラルの更新（イベントによるペナルティ適用）
        if (data.morale !== morale) {
            setMorale(data.morale);
            alert(`Morale Check: Morale dropped to ${data.morale}`);
        }

        // 3. ログ表示
        if (data.logs.length > 0) {
            console.log(data.logs);
            // 必要に応じてUI上のログウィンドウに追加
        }
        
        // 4. フェーズ進行
        // 自動でSupplyフェーズへは行かず、ユーザーが結果を確認してから「Next Phase」を押す形式が望ましい
        // あるいはボタンを「Proceed to Supply」に切り替える
        
    } catch (e) {
        console.error("Event API Error", e);
    }
};
```

## 3. UIコンポーネントの追加・変更

### A. イベント情報パネル (Event Status Box)
サイドバーまたは画面上部に、現在のイベント状況を常時表示するボックスを追加します。

*   **表示内容**: イベント名、出目、効果の要約。
*   **デザイン**: `No Result` なら目立たない色、`Japanese Attack` なら赤枠などの視覚的フィードバック。

```jsx
{/* サイドバー内に追加 */}
<div style={{ padding: '10px', border: '1px solid #666', marginTop: '10px', background: '#2a2a2a' }}>
    <div style={{ fontSize: '0.9rem', color: '#aaa' }}>Current Event:</div>
    {currentEvent ? (
        <>
            <div style={{ fontWeight: 'bold', color: '#ffcc00', marginBottom: '5px' }}>
                {currentEvent.name}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
                Type: {currentEvent.type}<br/>
                Roll: {currentEvent.roll}
            </div>
        </>
    ) : (
        <div style={{ fontStyle: 'italic', color: '#555' }}>None</div>
    )}
</div>
```

### B. 操作ボタン
`handleStartGame` や `handleDawnPhase` があるコントロールエリアに、フェーズ依存のボタンを表示します。

*   **Current Phase = 'Event' の時**: 
    *   未実施なら: `[Roll for Event]` ボタン
    *   実施済みなら: `[Proceed to Supply Phase]` ボタン (次のフェーズへ)

### C. 視覚効果 (Visual Indicators)
*   **Pauseの場合**: 対象となる師団（例：1st Cav）のユニットの上に「停止アイコン」や「グレーアウト」のようなオーバーレイを表示すると分かりやすいですが、まずはステータス表示のみで対応します。

## 4. 既存ロジックへの影響

*   **End Phase (`handleEndPhase`)**:
    *   ターン終了時に `currentEvent` をクリアするか、または「前のターンのイベント」として `lastEvent` に移し、`currentEvent` は `null` にリセットする処理が必要です。
    *   提案: `handleEndPhase` 内で `setCurrentEvent(null)` を実行。

---
**確認事項**:
この構成で実装を進めてよろしいでしょうか？
特に「イベント結果を確認してから次へ進む」という2段階ステップ（ダイス振る -> 結果見る -> 次へ）が、ボードゲームのUXとして適切と考えています。
