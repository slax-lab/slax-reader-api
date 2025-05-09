# 🌟 貢献ガイドライン

まず、私たちのプロジェクトに貢献することを検討していただき、ありがとうございます！私たちは、あなたがオープンソースコミュニティに参加し、貢献者として加わることを歓迎します。このプロジェクトをより良くするのは、あなたのような開発者です。

## 🤔 どのように貢献するか？

### 🐞 バグの報告

バグを発見した場合は、issueを開き、以下の詳細を提供してください：

- 明確で説明的なissueタイトル
- 問題を再現するための手順の説明
- 問題を理解するのに役立つ追加情報やスクリーンショット

### 💡 改善提案

私たちは常に新しいアイデアを歓迎しています！提案がある場合は：

- "Feature Request" issueテンプレートを使用するか、新しいissueを作成してください
- 望む改善点を説明し、それがなぜ有用であるかを説明してください

### 🔰 初めてのコード貢献

どこから始めればよいかわからない？"good first issue"ラベルの付いた初心者向けの問題を見つけることができます。これらのissueに取り組むことで、より複雑な問題に取り組む前にコードベースに慣れることができます。

### 🔄 プルリクエスト

コードの変更を行う準備ができたら、プルリクエストを作成してください：

1. リポジトリをフォークし、ローカルマシンにクローンします
2. 新しいブランチを作成：`git checkout -b your-branch-name`
3. 変更を行います
4. 必要なテストと機能の検証をローカルで完了した後、以下の形式でコミットメッセージを使用して変更をコミットします：

   ```
   emoji 短い説明

   emoji issue: #xxx (Issue Number)
   ```

   emojiは以下のタイプに対応する必要があります：

   - ✨ (新機能)
   - 🐛 (バグ修正)
   - ♻️ (コードリファクタリング)
   - ⚡ (パフォーマンス改善)
   - 🔧 (インフラ/ツール)
   - 🧪 (テスト)
   - 📝 (ドキュメント)
   - ...[詳細はこちら](https://gist.github.com/parmentf/035de27d6ed1dce0b36a)

5. 変更をリモートブランチにプッシュし、プルリクエストを開始します

### 📜 貢献者契約

**重要な注意事項：** 提出されたプルリクエストは、商業版にマージまたは組み込まれる可能性があります。PRを提出する前に、貢献者の同意書に署名する必要があります。

私たちは [CLA Assistant](https://github.com/cla-assistant/cla-assistant) Bot を使用してこのプロセスを管理しています。最初のPRを提出すると、CLA Assistant Botが自動的にPRコメントにリンクを追加し、署名プロセスを案内します。リンクをクリックし、指示に従って署名を完了するだけです。このプロセスは、最初の貢献時に一度だけ完了する必要があります。

署名プロセスが完了すると、Botは自動的にPRステータスを更新し、あなたが私たちの条項に同意したことを示します。署名されていないPRはマージできないことに注意してください。

## 🎨 コードスタイルガイド

私たちのプロジェクトは、以下のコア仕様に従います：

### 1. アーキテクチャ設計

- **ドメイン駆動設計(DDD)**
  - 明確なレイヤードアーキテクチャ：プレゼンテーション層、アプリケーション層、ドメイン層、インフラ層
  - 明確な境界コンテキストを使用して異なるビジネスドメインを分離
  - レイヤー間の依存関係が一方向に流れることを保証

### 2. 開発標準

- **依存性注入**

  - デコレータを使用して依存性注入と制御の反転を実現
  - シングルトンや静的メソッドの使用を避ける
  - コンストラクタを通じて依存性を注入し、コードのテスト可能性を向上

- **TypeScript コーディング標準**

  - ファイル命名：camelCaseを使用（例：`userService.ts`）
  - クラス命名：PascalCaseを使用（例：`UserService`）
  - メソッド命名：camelCaseを使用（例：`createUser`）
  - インターフェース命名：PascalCaseを使用（例：`UserInterface`）

- **非同期処理**
  - 非同期操作にはasync/awaitを優先して使用
  - コールバック地獄を避け、コードをフラットに保つ

### 3. コード品質

- **エラーハンドリング**

  - カスタムエラークラスを使用してエラーを分類
  - 統一されたエラーハンドリングメカニズム
  - 標準化されたエラーレスポンス形式

- **コメント標準**

  - 公共APIには明確なドキュメントコメントを提供
  - 複雑なロジックには必要な説明コメントを追加
  - TODO/FIXMEなどのマーカーを使用して対処すべき問題を示す

これらのガイドラインに従ってコードが一貫性と保守性を保つようにしてください。疑問がある場合は、既存のコードの実装方法を参照してください。

## 🧪 テスト

変更がテストでカバーされていることを確認してください（該当する場合）。既存のテストを実行して、すべてが期待通りに動作することを確認してください。

## 🤝 行動規範

このプロジェクトのすべての参加者は、私たちの行動規範に従う必要があることに注意してください。参加することで、その条項に従うことに同意したことになります。

### ✨ 私たちの誓い

オープンで歓迎的な環境を育むために、私たち貢献者とメンテナは、年齢、体型、障害、民族、性別特性、性同一性と表現、経験レベル、教育、社会経済的地位、国籍、個人の外見、種族、宗教、または性的指向に関係なく、私たちのプロジェクトとコミュニティへの参加が嫌がらせのない経験であることを誓います。

### 📏 私たちの基準

積極的な環境を作り出す行動には以下が含まれます：

- 友好的で包括的な言語を使用する
- 異なる視点や経験を尊重する
- 建設的な批判を優雅に受け入れる
- コミュニティにとって最も有益なことに焦点を当てる
- 他のコミュニティメンバーに対して共感を示す

あなたの貢献を楽しみにしています！ご支援ありがとうございます！
