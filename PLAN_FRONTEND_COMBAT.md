# フロントエンド戦闘実装計画 (Frontend Combat Implementation Plan)

戦闘処理の完全実装に向けた、フロントエンド（React/Konva）のアーキテクチャと実装ステップの計画です。

## 1. 全体フロー (User Flow)

戦闘は「移動フェーズでの接敵」から「戦闘フェーズでの解決」までの一連の流れとして実装します。

### Phase A: 接敵と移動 (Contact)
1.  **移動操作**: プレイヤーが米軍ユニットを日本軍支配エリア（または未確認エリア）にドラッグ＆ドロップ。
2.  **移動検証 (`validate_move`)**:
    *   バックエンドAPIを呼び出し、コストと「Mandatory Attack (攻撃義務)」フラグを確認。
    *   **警告表示**: 「この移動は戦闘を引き起こします (Cost: 3/4)」。承認すると移動実行。
3.  **状態更新**: ユニットがエリア内に配置される。この時点では戦闘は解決せず、エリアが**「戦闘状態 (Contested/Combat Pending)」**としてマークされる（マップ上にアイコン表示など）。

### Phase B: 戦闘フェーズ (Combat Phase)
1.  **フェーズ移行**: プレイヤーが「Combat Phase」ボタンをクリック。
2.  **ターゲット選択**: マップ上で「戦闘状態」のエリアがハイライトされる。プレイヤーはいずれかのエリアをクリックして戦闘を開始。
3.  **戦闘ウィンドウ (`CombatModal`) 起動**:
    *   **Step 1: Contact Analysis (接触確認)**:
        *   エリア内の参加米軍ユニット一覧を表示。
        *   日本軍ユニットは「未確認 (Face Down)」状態で表示。
        *   「Reveal Enemy」ボタンを表示。
    *   **Step 2: Reveal & Strategy (敵情判明・防御戦術)**:
        *   ボタン押下で日本軍ユニットを判明（Open）。
        *   **防御戦略 (Defense Strategy) の発動**: 
            *   'Sniper', 'Ambush', 'Barrage' などの効果を**即座に適用**。
            *   例: Ambushでユニットが除去された場合、その場リストから削除し、ログを表示。
    *   **Step 3: Tactical Decisions (戦術決定)**:
        *   判明した敵と生き残った味方を見て、プレイヤーが戦術を決定。
        *   **Lead Unit選択**: 生存ユニットから主攻部隊をクリックで選択。
        *   **支援マーカー投入**: 砲兵・工兵・航空支援の投入数を決定。
        *   **数値確認**: `/api/combat/calculate` を呼び出し、最終的な AV (攻撃力) と DV (防御力) をプレビュー。
    *   **Step 4: Resolution (解決)**:
        *   **ダイスロール**: 「Roll」ボタン押下 -> `/api/combat/resolve` 呼び出し。
        *   **結果表示**: ダイス目と結果（Success, Overrun等）のアニメーション表示。
    *   **Step 5: Apply (結果適用)**:
        *   「Apply Result」ボタン（または自動）。
        *   `/api/combat/apply_result` を呼び出し。
        *   ユニットの除去、状態変更（Spent/Fresh）、士気更新、支配マーカー配置を反映。
        *   ウィンドウを閉じる。

## 2. コンポーネント構成 (Component Architecture)

既存の `App.jsx` と `CombatModal.jsx` を拡張します。

### `App.jsx`
*   **State管理**:
    *   `combatQueue`: 戦闘が必要なエリアのリスト。
    *   `currentCombatArea`: 現在処理中のエリア情報。
*   **API連携**: `useCombat` カスタムフック等の作成を検討（ロジック分離のため）。
*   **MapLayer**:
    *   戦闘発生エリアに「⚔️」マーカーを表示するレイヤーを追加。

### `CombatModal.jsx` (機能拡張)
*   **フェーズ管理**: モーダル内でのStep遷移 (Setup -> Reveal -> Resolution -> Result)。
    *   現状のモックは1画面ですべて表示しているが、Revealの前後で情報を切り替える。
*   **防御戦略エフェクト**:
    *   Reveal時に「Ambush!」等のカットイン演出を表示。
*   **Result View**:
    *   結果に応じたテキストと「Close / Next」ボタン。

## 3. 実装ステップ (Implementation Steps)

1.  **Step 1: 移動と戦闘フラグの連携**
    *   `validate_move` のレスポンスに含まれる `mandatory_attack` を受け取り、移動後のエリア状況を判定するロジックを `App.jsx` に追加。

2.  **Step 2: CombatModal の本番化**
    *   仮の計算ロジック (`recalculate`) を廃止し、バックエンドAPI `/api/combat/calculate` に置き換え。
    *   「Reveal」概念の導入（Defender Unit情報の取得）。

3.  **Step 3: 戦闘解決と結果適用**
    *   `Roll` ボタンで `/api/combat/resolve` をコール。
    *   結果画面の実装。
    *   `Apply` 処理で `/api/combat/apply_result` をコールし、フロントエンドの `units` ステートを一括更新。

4.  **Step 4: サポート機能 (Support Features)**
    *   支援マーカーの消費管理（Used Boxへの移動）。
    *   士気（Morale）の連動更新。

## 4. データフロー (Data Flow)

```mermaid
graph TD
    User[User Action] -->|Drag Unit| App[App.jsx]
    App -->|Validate| API_Move[API: validate_move]
    API_Move -->|Result| App
    App -->|Update UI| Map[Map View]
    
    User -->|Open Combat| Modal[CombatModal]
    Modal -->|Select Load/Support| Modal
    Modal -->|Get Stats| API_Calc[API: calculate]
    API_Calc -->|AV/DV| Modal
    
    Modal -->|Roll| API_Res[API: resolve]
    API_Res -->|Result (Success/Overrun)| Modal
    
    Modal -->|Apply| API_Apply[API: apply_result]
    API_Apply -->|New Unit States| App
    App -->|Reflect| Map
```

この計画で進めますか？
特に「移動直後の即時解決」ではなく、「戦闘フェーズでの選択解決」方式を標準としていますが、もし即時解決（RPGエンカウント方式）が良ければ調整します。
