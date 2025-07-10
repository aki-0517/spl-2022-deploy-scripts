```ts
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  updateRateInterestBearingMint,
  createInitializeInterestBearingMintInstruction,
  createInitializeMintInstruction,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  amountToUiAmount,
  getInterestBearingMintConfigState,
  getMint,
} from "@solana/spl-token";

// Playground wallet
const payer = pg.wallet.keypair;

// Connection to devnet cluster
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Transaction signature returned from sent transaction
let transactionSignature: string;

// Generate new keypair for Mint Account
const mintKeypair = Keypair.generate();
// Address for Mint Account
const mint = mintKeypair.publicKey;
// Decimals for Mint Account
const decimals = 2;
// Authority that can mint new tokens
const mintAuthority = pg.wallet.publicKey;
// Authority that can update the interest rate
const rateAuthority = pg.wallet.keypair;
// Interest rate basis points (100 = 1%)
// Max value = 32,767 (i16)
const rate = 32_767;

// Size of Mint Account with extension
const mintLen = getMintLen([ExtensionType.InterestBearingConfig]);
// Minimum lamports required for Mint Account
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

// Instruction to invoke System Program to create new account
const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey, // Account that will transfer lamports to created account
  newAccountPubkey: mint, // Address of the account to create
  space: mintLen, // Amount of bytes to allocate to the created account
  lamports, // Amount of lamports transferred to created account
  programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
});

// Instruction to initialize the InterestBearingConfig Extension
const initializeInterestBearingMintInstruction =
  createInitializeInterestBearingMintInstruction(
    mint, // Mint Account address
    rateAuthority.publicKey, // Designated Rate Authority
    rate, // Interest rate basis points
    TOKEN_2022_PROGRAM_ID // Token Extension Program ID
  );

// Instruction to initialize Mint Account data
const initializeMintInstruction = createInitializeMintInstruction(
  mint, // Mint Account Address
  decimals, // Decimals of Mint
  mintAuthority, // Designated Mint Authority
  null, // Optional Freeze Authority
  TOKEN_2022_PROGRAM_ID // Token Extension Program ID
);

// Add instructions to new transaction
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeInterestBearingMintInstruction,
  initializeMintInstruction
);

// Send transaction
transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, mintKeypair] // Signers
);

console.log(
  "\nCreate Mint Account:",
  `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
);

// New interest rate in basis points
const updateRate = 0;
// Update interest rate on Mint Account
transactionSignature = await updateRateInterestBearingMint(
  connection,
  payer, // Transaction fee payer
  mint, // Mint Account Address
  rateAuthority, // Designated Rate Authority
  updateRate, // New interest rate
  undefined, // Additional signers
  undefined, // Confirmation options
  TOKEN_2022_PROGRAM_ID // Token Extension Program ID
);

console.log(
  "\nUpdate Rate:",
  `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
);

// Fetch Mint Account data
const mintAccount = await getMint(
  connection,
  mint, // Mint Account Address
  undefined, // Optional commitment
  TOKEN_2022_PROGRAM_ID // Token Extension Program ID
);

// Get Interest Config for Mint Account
const interestBearingMintConfig = await getInterestBearingMintConfigState(
  mintAccount // Mint Account data
);

console.log(
  "\nMint Config:",
  JSON.stringify(interestBearingMintConfig, null, 2)
);

// Wait 1 second
sleep(1000);

// Amount to convert
const amount = 100;
// Convert amount to UI amount with accrued interest
const uiAmount = await amountToUiAmount(
  connection, // Connection to the Solana cluster
  payer, // Account that will transfer lamports for the transaction
  mint, // Address of the Mint account
  amount, // Amount to be converted
  TOKEN_2022_PROGRAM_ID // Token Extension Program ID
);

console.log("\nAmount with Accrued Interest:", uiAmount);
```

このスクリプトは、Solana の Token Extensions にある「Interest‐Bearing Config」機能を使って、Devnet 上に利息計算付きのトークン（Mint アカウント）を作成し、その利率を更新→取得し、最後にある額に対して実際に複利計算された“見かけ上の残高”を算出する流れを自動化しています。主な処理をステップごとに解説します。

---

1. **ライブラリ＆定数の読み込み**

   * `@solana/web3.js`：Solana クラスターへの接続やアカウント操作用
   * `@solana/spl-token`：Token Extensions（利息算出など）の命令やユーティリティ関数用

2. **接続とウォレットの準備**

   ```ts
   const payer = pg.wallet.keypair;
   const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
   ```

   Devnet に接続し、Playground のウォレット（`payer`）を送金・署名アカウントとして設定。

3. **Mint アカウントの生成パラメータ設定**

   ```ts
   const mintKeypair = Keypair.generate();
   const mint          = mintKeypair.publicKey;
   const decimals      = 2;
   const mintAuthority = pg.wallet.publicKey;
   const rateAuthority = pg.wallet.keypair;
   const rate          = 32_767;  // basis points (i16 max)
   ```

   * `mintKeypair`：新規トークン（Mint）のキー
   * `decimals`：小数桁数
   * `mintAuthority`：トークン発行権限
   * `rateAuthority`：利率更新権限
   * `rate`：初期利率（100 = 1% → 32 767 ≒ 327.67%）

4. **Mint アカウントの作成＆初期化**

   1. **サイズ計算＋Rent‐exempt ラムポート取得**

      ```ts
      const mintLen  = getMintLen([ExtensionType.InterestBearingConfig]);
      const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
      ```
   2. **トランザクション構築**

      * `SystemProgram.createAccount`：拡張対応サイズで新規アカウント作成
      * `createInitializeInterestBearingMintInstruction`：利息算出機能を初期化
      * `createInitializeMintInstruction`：通常の Mint 初期化
   3. **送信＆確認**

      ```ts
      const tx = new Transaction().add(
        createAccountInstruction,
        initializeInterestBearingMintInstruction,
        initializeMintInstruction
      );
      transactionSignature = await sendAndConfirmTransaction(
        connection, tx, [payer, mintKeypair]
      );
      console.log("Create Mint Account:", signatureURL);
      ```

5. **利率のアップデート**

   ```ts
   transactionSignature = await updateRateInterestBearingMint(
     connection, payer, mint, rateAuthority, /* newRate= */0,
     undefined, undefined, TOKEN_2022_PROGRAM_ID
   );
   console.log("Update Rate:", signatureURL);
   ```

   Rate Authority によって、新しい basis points（ここでは 0）を設定。

6. **Mint 設定状態の取得**

   ```ts
   const mintAccount = await getMint(connection, mint, undefined, TOKEN_2022_PROGRAM_ID);
   const config      = await getInterestBearingMintConfigState(mintAccount);
   console.log("Mint Config:", JSON.stringify(config, null, 2));
   ```

   * 現在の利率、最終更新タイムスタンプなどのメタデータを取得して出力。

7. **実際の利息計算（複利シミュレーション）**

   ```ts
   sleep(1000);
   const amount   = 100;
   const uiAmount = await amountToUiAmount(
     connection, payer, mint, amount, TOKEN_2022_PROGRAM_ID
   );
   console.log("Amount with Accrued Interest:", uiAmount);
   ```

   * `amountToUiAmount` を呼ぶことで、「100（ベース量）」に対してネットワーク上のタイムスタンプに基づく複利計算を実行し、その結果を返す。

---

**まとめると**、このスクリプトは

1. Devnet に Interest‐Bearing 拡張付き Mint アカウントを作成
2. 利率を更新
3. 設定状態を取得
4. 指定量に対する複利計算結果を出力

までを一連のコードで実行するものです。
