# トークン操作ガイド

このガイドでは、ミントしたテストトークンの情報取得と編集方法について、コマンドベースの操作方法を説明します。

## 前提条件

- Solana CLIがインストールされている
- Solana CLIウォレットが設定されている (`solana-keygen new`)
- Node.js/TypeScript環境が設定されている
- このプロジェクトの依存関係がインストールされている (`yarn install`)

## 基本コマンド

### 1. トークンのデプロイ

#### インタラクティブデプロイ
```bash
yarn deploy
```
対話的にトークンの設定を行い、デプロイできます。

#### 事前定義テンプレートでのデプロイ
```bash
# USDC-TEST トークンをデプロイ
yarn deploy:usdc

# USDT-TEST トークンをデプロイ
yarn deploy:usdt

# DAI-TEST トークンをデプロイ
yarn deploy:dai
```

#### プログラム実行によるデプロイ
```bash
# シンプルなテストデプロイ
ts-node test-deploy.ts
```

### 2. トークン情報の取得

#### ミント情報の取得（Solana CLI）
```bash
# 基本情報の取得
solana account <MINT_ADDRESS> --output json

# SPL Token形式での情報取得
spl-token account-info <MINT_ADDRESS>

# 供給量情報の取得
spl-token supply <MINT_ADDRESS>
```

#### 利息設定情報の取得（TypeScript）
```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { getMint, getInterestBearingMintConfigState, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

const connection = new Connection("https://api.devnet.solana.com");
const mintAddress = new PublicKey("あなたのミントアドレス");

// ミント情報の取得
const mintAccount = await getMint(connection, mintAddress, undefined, TOKEN_2022_PROGRAM_ID);
console.log("ミント情報:", mintAccount);

// 利息設定の取得
const interestConfig = await getInterestBearingMintConfigState(mintAccount);
console.log("利息設定:", interestConfig);
```

#### デプロイ履歴の確認
```bash
# デプロイ履歴ファイルの一覧
ls deployments/

# 特定のデプロイ情報の確認
cat deployments/USDC-TEST_<タイムスタンプ>.json
```

### 3. トークン設定の編集

#### 利息レートの更新
```typescript
import { YieldBearingStablecoinDeployer } from './deploy-yield-bearing-stablecoin';

const deployer = new YieldBearingStablecoinDeployer();

// 利息レートを7%に更新（700 basis points）
const signature = await deployer.updateInterestRate(
  "あなたのミントアドレス",
  700 // 7% 年利
);

console.log("レート更新完了:", signature);
```

#### ウォレット残高の確認
```bash
# SOL残高の確認
solana balance

# トークン残高の確認
spl-token balance <MINT_ADDRESS>

# 全てのトークン残高の確認
spl-token accounts
```

#### 追加のトークンをミント
```bash
# 指定したアドレスに追加トークンをミント
spl-token mint <MINT_ADDRESS> <数量> <受取人アドレス>

# 自分のウォレットに追加トークンをミント
spl-token mint <MINT_ADDRESS> <数量>
```

### 4. エクスプローラーでの確認

#### Solana Explorer
```bash
# ミント情報をブラウザで確認
open "https://explorer.solana.com/address/<MINT_ADDRESS>?cluster=devnet"

# トランザクション情報をブラウザで確認
open "https://explorer.solana.com/tx/<トランザクション署名>?cluster=devnet"
```

### 5. よく使用するコマンド組み合わせ

#### デプロイからトークン情報確認まで
```bash
# 1. デプロイ実行
yarn deploy:usdc

# 2. デプロイ結果からミントアドレスを取得
MINT_ADDRESS=$(cat deployments/USDC-TEST_*.json | jq -r '.mintAddress' | tail -1)

# 3. トークン情報を確認
spl-token account-info $MINT_ADDRESS

# 4. エクスプローラーで確認
open "https://explorer.solana.com/address/${MINT_ADDRESS}?cluster=devnet"
```

#### 利息レート更新のワークフロー
```bash
# 1. 現在の利息設定を確認
spl-token account-info <MINT_ADDRESS>

# 2. TypeScriptで利息レートを更新
ts-node -e "
import('./deploy-yield-bearing-stablecoin').then(m => {
  const deployer = new m.YieldBearingStablecoinDeployer();
  deployer.updateInterestRate('ミントアドレス', 800) // 8%に変更
    .then(sig => console.log('更新完了:', sig))
    .catch(console.error);
});
"

# 3. 更新後の設定を確認
spl-token account-info <MINT_ADDRESS>
```

## デプロイメント情報の構造

deployments フォルダに保存される JSON ファイルの構造：

```json
{
  "mintAddress": "GZqDJrCdCuj3jW5Q1VGGFb1YfytvGzAAAYjmqtx2Zx3Y",
  "transactionSignatures": ["..."],
  "config": {
    "tokenName": "USD Coin Test",
    "tokenSymbol": "USDC-TEST",
    "decimals": 6,
    "mintAuthority": "...",
    "rateAuthority": "...",
    "interestRateBasisPoints": 500,
    "initialSupply": 1000,
    "totalSupply": "1000000000",
    "lastUpdateTimestamp": 1752117855
  },
  "deploymentTime": "2025-07-10T03:24:17.930Z"
}
```

## 利用可能なテンプレート

### USDC_TEST
- **名前**: USD Coin Test
- **シンボル**: USDC-TEST
- **小数点以下桁数**: 6
- **デフォルト供給量**: 1,000,000 トークン
- **利息レート**: 年利5%

### USDT_TEST
- **名前**: Tether Test
- **シンボル**: USDT-TEST
- **小数点以下桁数**: 6
- **デフォルト供給量**: 500,000 トークン
- **利息レート**: 年利3%

### DAI_TEST
- **名前**: Dai Stablecoin Test
- **シンボル**: DAI-TEST
- **小数点以下桁数**: 18
- **デフォルト供給量**: 100,000 トークン
- **利息レート**: 年利4%

## トラブルシューティング

### SOL残高不足の場合
```bash
# Devnet SOLのリクエスト
solana airdrop 2

# 残高確認
solana balance
```

### ウォレット設定の確認
```bash
# 現在のウォレット確認
solana address

# 現在のクラスター確認
solana config get

# Devnetに設定
solana config set --url devnet
```

### 権限エラーの場合
- ミント権限または利息レート権限が正しく設定されているか確認
- 対応する秘密鍵を持っているか確認

## 注意事項

- これらの操作はすべて **Devnet** 環境での実行を想定しています
- Mainnet での実行は慎重に行ってください
- 秘密鍵の管理には十分注意してください
- トークンのテストは少額から始めることを推奨します