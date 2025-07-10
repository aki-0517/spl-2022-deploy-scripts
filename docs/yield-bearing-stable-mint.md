以下では、先ほどの Interest-Bearing Config 拡張を使って、Devnet 上に「利息付き Stablecoin」を発行（mint）するまでの手順をまとめます。

---

## 1. 前提準備

* **Solana Wallet**：Solana Playground またはローカル環境で Devnet のウォレットを用意し、`solana airdrop 5` などで十分な SOL を確保しておく。
* **依存ライブラリ**：

  ```bash
  npm install @solana/web3.js @solana/spl-token
  ```

---

## 2. スクリプトの雛形

```ts
import {
  Connection,
  Keypair,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createInitializeInterestBearingMintInstruction,
  createInitializeMintInstruction,
  mintTo,
  getMint,
  getInterestBearingMintConfigState,
} from "@solana/spl-token";

// ① ウォレットと接続
const payer = /* pg.wallet.keypair or your Keypair */;
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
```

---

## 3. Interest-Bearing Mint アカウントの作成

1. **Keypair 生成 & パラメータ定義**

   ```ts
   const mintKeypair = Keypair.generate();
   const mintPubkey  = mintKeypair.publicKey;
   const decimals    = 6;           // Stablecoin は 6 小数点が一般的
   const mintAuth    = payer.publicKey;
   const rateAuth    = payer;       // 同じキーで利率操作
   const interestBps = 100;         // 年率1%相当の basis points
   ```
2. **アカウントサイズと Rent-exempt**

   ```ts
   const mintLen  = getMintLen([ExtensionType.InterestBearingConfig]);
   const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
   ```
3. **トランザクション構築**

   ```ts
   // アカウント作成
   const createAccIx = SystemProgram.createAccount({
     fromPubkey: payer.publicKey,
     newAccountPubkey: mintPubkey,
     space: mintLen,
     lamports,
     programId: TOKEN_2022_PROGRAM_ID,
   });
   // Interest-Bearing 初期化
   const initIbIx = createInitializeInterestBearingMintInstruction(
     mintPubkey, rateAuth.publicKey, interestBps, TOKEN_2022_PROGRAM_ID
   );
   // 通常の Mint 初期化
   const initMintIx = createInitializeMintInstruction(
     mintPubkey, decimals, mintAuth, null, TOKEN_2022_PROGRAM_ID
   );
   ```
4. **送信**

   ```ts
   const tx = new Transaction().add(createAccIx, initIbIx, initMintIx);
   await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair]);
   console.log("Interest-Bearing Mint created:", mintPubkey.toBase58());
   ```

---

## 4. Stablecoin トークンの発行（Mint）

1. **ユーザー用 Associated Token Account を準備**

   ```ts
   import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

   const userAta = await getAssociatedTokenAddress(mintPubkey, payer.publicKey);
   const ataIx   = createAssociatedTokenAccountInstruction(
     payer.publicKey, userAta, payer.publicKey, mintPubkey
   );
   ```
2. **Mint To**

   ```ts
   const amountToMint = 1_000_000; // 1.0 Stablecoin (6decimals)
   const mintIx = mintTo(
     connection,
     payer,            // fee payer
     mintPubkey,       // mint account
     userAta,          // to account
     mintAuth,         // mint authority
     amountToMint,
     [],               // additional signers
     TOKEN_2022_PROGRAM_ID
   );
   const tx2 = new Transaction().add(ataIx, mintIx);
   await sendAndConfirmTransaction(connection, tx2, [payer]);
   console.log("Minted tokens to:", userAta.toBase58());
   ```

---

## 5. 利率更新と状態確認

* **利率アップデート**

  ```ts
  import { updateRateInterestBearingMint } from "@solana/spl-token";

  await updateRateInterestBearingMint(
    connection, payer, mintPubkey, rateAuth, /* newBps= */150,
    undefined, undefined, TOKEN_2022_PROGRAM_ID
  );
  ```
* **設定状態の取得**

  ```ts
  const onchainMint = await getMint(connection, mintPubkey, undefined, TOKEN_2022_PROGRAM_ID);
  const config      = await getInterestBearingMintConfigState(onchainMint);
  console.log("Mint Config:", config);
  ```

---

## 6. 利息のシミュレーション計算

* **オフチェーン計算**（トランザクション不要）

  ```ts
  import { uiAmountToAmountForMintWithoutSimulation } from "@solana/spl-token";

  const display = await uiAmountToAmountForMintWithoutSimulation(
    connection, mintPubkey, /* baseAmount= */1_000_000
  );
  console.log("1 Stablecoin の見かけ残高:", display);
  ```

---

以上で、Devnet 上に Interest-Bearing 拡張付きの Stablecoin Mint を作成し、トークン発行・利率管理・利息計算まで一通り実行できます。必要に応じて、フロントエンドからこれらの RPC 呼び出しをラップして UI を構築してください。
