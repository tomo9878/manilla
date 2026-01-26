# Manila: Savage Streets, 1945 - 開発ロードマップ

## フェーズ1: 視覚・操作基盤の構築 (UI/UX)
**目標**: まずはルール等の判定は行わず、地図上でコマを自由に配置・移動できる「サンドボックス（箱庭）」状態を作る。

### 1.1 ユニットとアセットのシステム
- [x] **画像の読み込み**: `buildFile.xml` に記載されているユニット画像（カウンター）をフロントエンドで表示できるようにする。
- [x] **ユニットコンポーネント作成**: Reactでユニットを表示する共通部品を作る（表面 / 裏面 / 負傷面 の切り替えロジック含む）。
- [x] **スタック（重なり）の可視化**: 1つのエリアに複数のユニットがある場合の表示処理。
    - [x] マウスホバーやクリックで重なっているユニットを展開して表示する「スタックビュー」。
    - [x] クリックによる回転と、ホバーによる一覧表示を実装済み。

### 1.2 盤面操作
- [x] **初期配置の描画**: 「PredefinedSetup」（初期配置データ）を読み込み、ユニットを正しい開始エリアに配置する。
- [x] **ドラッグ＆ドロップ移動**: ドラッグ操作でエリアからエリアへユニットを移動できるようにする。
    - [ ] `map_data.json` の座標を使って、ドロップ時にエリアの中心へ綺麗に吸着させる。（現在は座標更新のみ、吸着は未実装）
- [x] **状態更新**: フロントエンド内部で「どのエリアにどのユニットがいるか」というリストを管理・更新できるようにする。

### 1.3 マーカー・情報表示
- [ ] **支配マーカー**: エリアごとの「アメリカ軍支配」「日本軍支配」を切り替える視覚的なトグル機能。
- [ ] **ゲームトラック表示**: マップ右側にある記録トラックの実装：
    - [ ] ターン記録（Turn 1-9）
    - [ ] 勝利ポイント（VP）トラック
    - [ ] インパルス/フェイズ記録

---

## フェーズ 2: ゲームロジック実装（バックエンド: Python/Flask）
**目標**: サーバー側で厳格なルール判定を行い、ターン進行、エリアインパルス、戦闘解決、およびリソース管理を行う。

### 2.1 基幹リソース管理（Global State）
- [x] **補給ポイント (Supply Points)**:
    - [ ] `0`〜`無制限`。ターン開始時に `4d6` で増加（T1は最低12）。
    - [x] 消費アクション（支援購入、OOA復帰）の実装。
    - [ ] 未消費分の持ち越し処理。
- [ ] **米軍士気 (American Morale)**:
    - [ ] `0`〜`19`。初期値の設定。
    - [ ] 戦闘結果（Repulse）やイベントによる減少処理。
    - [ ] エリア占領による向上処理。
    - [ ] 閾値判定: 10以上(Strong), 9以下(Shaken) のフラグ管理。
- [x] **占領エリア数 (Control) & VP**:
    - [x] 米軍支配エリア数のカウント（手動切り替え・カウンター実装済み）。
    - [ ] 勝利条件判定（最終Tに34エリア以上 + イントラムロス）。

### 2.2 支援・ユニットリソース管理
- [x] **支援マーカー (Support Markers)**:
    - [x] `Artillery` ($1), `Engineer` ($2), `Air Support` (条件付き) の購入ロジック。
    - [x] 状態管理: `Available`（購入済み）⇔ `Used`（使用済み）。
    - [x] ターン終了時のリセット（再購入ルール）の実装。
- [x] **戦線離脱部隊 (Out of Action Units)**:
    - [x] 戦闘結果によるユニットの `OOA` ボックスへの移動。
    - [x] 補給ポイント支払によるマップ復帰ロジック。

### 2.3 ターン進行とフェーズ管理 (Turn Sequence)
- [x] **1. 夜明けフェーズ (Dawn Phase)**:
    - [x] **増援 (Reinforcement)**:
        - [x] Turn 2: 第11空挺師団 (Area 30/27/28).
        - [x] Turn 6: 第754戦車大隊 (Area 1, 2).
    - [x] **部隊撤退 (Withdrawal)**:
        - [x] Turn 6: 第44戦車大隊除去。OOAにある場合 Morale -1/unit のペナルティ。
    - [x] **指揮官の運命判定 (Leader Mortality)**:
        - [x] 前ターンOOAのリーダーにつき 1d6 (1-2:KIA, 3-4:Wounded/Return Next, 5-6:Immediate).
- [x] **2. ランダムイベント (Random Event Phase)**:
    - [x] 3d6 ロールとイベントテーブル参照 (Pause, Civilians, Japanese Attack etc).
    - [x] **例外処理 (Rule 6.2)**: 第1/9ターンのPause無効、連続Pause無効、岩淵脱出の条件判定を実装済み。
- [x] **3. 補給フェーズ (Supply Phase)**
    - [x] 補給ポイント生成 (4d6)
    - [x] 士気向上アクション (+1 Morale for 3 Supply)
    - [x] 支援ユニット購入 (Tank, Artillery, Air Support)
    - [x] ユニット回復 (Out of Action -> Map)
- [ ] **4. 戦闘フェーズ (Combat Phase)** - *In Progress*
    - [ ] 市街戦判定 (Bloody Streets) - Phase Start
    - [ ] インパルスシステム (Activation / Spent)
    - [ ] 移動ロジック (Movement & Infiltration)
    - [ ] 戦闘解決 (Combat Resolution tables & dice)
    - [ ] 勝利条件チェック (Control Points) (Bloody Streets)**: 争奪中Urban/Fortエリア数×1d6で被害判定。
    - [ ] **アクションラウンド (Impulse System)**:
        - [ ] エリア活性化 -> 移動/戦闘 -> Spent化 のループ。
        - [ ] パス or 全ユニットSpentで終了。
- [ ] **5. 終了フェーズ (End Phase)**:
    - [ ] 全ユニット Fresh 化(済)。
    - [ ] 士気自然減少 (-1)。
    - [ ] ターンマーカー進行。

### 2.5 ターン別・例外ルール (Specific Turn Rules)
- [x] **Turn 1 例外**:
    - [ ] **補給 (Supply)**: 4d6の結果が12未満なら `12` に切り上げ（最低保証）。
    - [x] **イベント (Event)**: 'Pause' (行動停止) が出ても 'No Result' として扱う。
    - [x] **夜明け (Dawn)**: 増援・撤退・指揮官判定なし。
- [x] **Turn 9 例外 (Final Turn)**:
    - [x] **イベント (Event)**: 'Pause' は 'No Result' として扱う。
- [ ] **Turn 1-3 制限**:
    - [ ] **砲兵制限 (Artillery Limit)**: 1戦闘につき最大1枚まで（マッカーサーの制限）。
        - [ ] Turn 4以降は制限解除。

---

## フェーズ 3: インタラクションとUIの強化
**目標**: 管理データを視覚化し、ブラウザ上でボードゲームとしての操作感を完成させる。

### 3.1 ヘッダー/サイドバー情報パネル
- [x] **リソース表示**: Supply, Morale, Control数, Turn数を常時表示するパネル作成。
    - [ ] Moraleの状態（Strong/Shaken）を視覚的に強調。
- [x] **ランダムイベント表示**: 現在適用中のイベント内容を表示するエリア。

### 3.2 専用ボックスUI
- [x] **Support Units Box**:
    - [x] 購入ボタン（Supply消費）と、Available/Usedマーカーの表示。
    - [x] 戦闘時のドラッグ＆ドロップ使用（または選択使用）。
- [x] **Out of Action Box**:
    - [x] 除去されたユニットを並べるエリア。
    - [x] 復帰ボタン（Supply消費してマップへ戻す）。

### 3.3 マップ上のステータス可視化
- [x] **支配マーカー (Control Markers)**:
    - [x] エリアごとの支配状況（US/JP）をアイコンで表示（エリアハイライトで実装）。
    - [x] エリア占領時に自動で切り替わるアニメーション（手動切り替え・色変化実装済み）。
- [ ] **Active Areaハイライト**:
    - [ ] 現在活性化しているエリアを枠線や色で強調表示。

### 3.4 仕上げ
- [ ] **ログ履歴**: リソース変動やダイス結果のログ表示。
- [ ] **セーブ/ロード**: ゲーム中断・再開機能。


## フェーズ 4: ルール詳細実装とエフェクト
- [ ] **Area Control Logic**: Implement logic to determine which side controls each area. (Required for victory conditions and unit recovery costs).
- [ ] **Unit Recovery Highlight**: When recovering a unit from OOA, highlight valid placement options (areas with same-division units in US control, or initial areas) with a pulsing visual effect.

### 戦闘・運用ルール詳細
- [ ] **親部隊の制約 (Parent Formation)**: 攻撃に参加する師団が複数ある場合、2つ目以降の師団ごとに攻撃値(AV) -1。
- [ ] **瓦礫の山 (Rubble)**:
    - [ ] Urban/Fortエリア攻撃時、工兵(Engineer)なしでは諸兵科連合ボーナス(Combined Arms)無効。
    - [ ] Fortエリアではオーバーラン発生不可（勝利してもSpentになる）。
- [ ] **航空支援 (Air Support)**:
    - [ ] 解禁条件: 米軍士気が一度でも9以下(Shaken)になったら購入可能フラグをONにする（永続）。
    - [ ] 効果: 日本軍防御値(DV)を -1d6 する（最低0）。
- [ ] **砲兵支援の制限 (Artillery)**:
    - [ ] Turn 1-3: 1戦闘につき砲兵は1枚まで。
    - [ ] Turn 4+: 制限解除（ルール通り投入可能）。
