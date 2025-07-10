# Yield-Bearing Stablecoin Deployment Scripts

このディレクトリには、Solana devnet に yield-bearing stablecoin テストトークンを簡単にデプロイするためのスクリプトが含まれています。

## 🚀 Quick Start

### 1. 依存関係のインストール

```bash
cd mint-scripts
yarn install
```

### 2. インタラクティブデプロイメント

```bash
yarn deploy
```

このコマンドを実行すると、対話型のプロンプトが表示され、以下を設定できます：
- テンプレートの選択（USDC-TEST, USDT-TEST, DAI-TEST）またはカスタム設定
- トークン名とシンボル
- 小数点以下桁数
- 初期供給量
- 年利率（APY）
- 受取人のウォレットアドレス

### 3. 事前定義されたテンプレートでの迅速なデプロイ

```bash
# USDC テストトークン（6小数点、5% APY、1M供給量）
yarn deploy:usdc

# USDT テストトークン（6小数点、3% APY、500K供給量）
yarn deploy:usdt

# DAI テストトークン（18小数点、4% APY、100K供給量）
yarn deploy:dai
```

## 📋 利用可能なテンプレート

| テンプレート | トークン名 | シンボル | 小数点 | 初期供給量 | 年利率 |
|-------------|-----------|---------|--------|-----------|--------|
| USDC_TEST   | USD Coin Test | USDC-TEST | 6 | 1,000,000 | 5% |
| USDT_TEST   | Tether Test | USDT-TEST | 6 | 500,000 | 3% |
| DAI_TEST    | Dai Stablecoin Test | DAI-TEST | 18 | 100,000 | 4% |

## 🔧 カスタム設定

カスタム設定を使用する場合、以下のパラメータを指定できます：

- **Token Name**: トークンの正式名称
- **Token Symbol**: トークンのシンボル（例：USDC、USDT）
- **Decimals**: 小数点以下の桁数（通常6または18）
- **Initial Supply**: 初期供給量（トークン数）
- **Interest Rate**: 年利率（パーセンテージ、例：5 = 5%）
- **Recipient**: トークンを受け取るウォレットアドレス（オプション）

## 📁 ファイル構成

```
mint-scripts/
├── deploy-yield-bearing-stablecoin.ts    # メインのデプロイヤークラス
├── deploy-interactive.ts                 # インタラクティブなCLIインターフェース
├── package.json                          # 依存関係とスクリプト
├── tsconfig.json                         # TypeScript設定
├── README.md                             # このファイル
└── deployments/                          # デプロイ結果の保存先（自動作成）
    └── *.json                           # デプロイ詳細情報
```

## 🔐 セキュリティ注意事項

- ⚠️ **これはテスト用のスクリプトです**：本番環境での使用は推奨されません
- 🔑 **ウォレット管理**: スクリプトは新しいキーペアを自動生成します
- 💧 **Devnet SOL**: スクリプトが自動的にdevnet SOLのエアドロップを要求します
- 📊 **デプロイ情報**: 全てのデプロイ詳細は`deployments/`フォルダに保存されます

## 🛠 利用可能な機能

### YieldBearingStablecoinDeployer クラス

```typescript
// 基本的な使用方法
import { YieldBearingStablecoinDeployer, STABLECOIN_CONFIGS } from './deploy-yield-bearing-stablecoin';

const deployer = new YieldBearingStablecoinDeployer();

// SOLのエアドロップを要求
await deployer.requestAirdrop();

// テンプレートを使用してデプロイ
const result = await deployer.deploy(STABLECOIN_CONFIGS.USDC_TEST);

// 利率の更新
await deployer.updateInterestRate(result.mintAddress, 600); // 6%に変更
```

### デプロイ結果

デプロイが完了すると、以下の情報が返されます：

```json
{
  "mintAddress": "ソラナのミントアドレス",
  "transactionSignatures": ["トランザクション署名の配列"],
  "config": {
    "tokenName": "トークン名",
    "tokenSymbol": "シンボル",
    "decimals": 6,
    "mintAuthority": "ミント権限のアドレス",
    "rateAuthority": "利率変更権限のアドレス",
    "interestRateBasisPoints": 500,
    "initialSupply": 1000000,
    "totalSupply": "現在の総供給量",
    "lastUpdateTimestamp": 1234567890
  },
  "deploymentTime": "ISO 8601 形式のタイムスタンプ"
}
```

## 🔗 Explorer リンク

デプロイ完了後、以下のリンクが表示されます：
- **Mint Address**: Solana Explorer でのミントアカウント詳細
- **Transaction Signatures**: 各トランザクションの詳細

例：
```
https://explorer.solana.com/address/MINT_ADDRESS?cluster=devnet
https://explorer.solana.com/tx/TRANSACTION_SIGNATURE?cluster=devnet
```

## 🐛 トラブルシューティング

### よくあるエラー

1. **Insufficient SOL**: 
   - 解決方法: `yarn deploy` を再実行し、エアドロップを要求する

2. **Network timeout**:
   - 解決方法: Solana devnet の状態を確認し、しばらく待ってから再試行

3. **Invalid public key**:
   - 解決方法: 公開キーの形式が正しいか確認（Base58エンコード）

### デバッグモード

デバッグ情報を表示するには：

```bash
DEBUG=* yarn deploy
```

## 📚 参考資料

- [Solana Token Extensions Documentation](https://solana.com/developers/guides/token-extensions)
- [Interest-Bearing Tokens Guide](https://solana.com/developers/courses/token-extensions/interest-bearing-token)
- [SPL Token Documentation](https://spl.solana.com/token)
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)