以下のガイドは、Solana Token Extensions の Interest-Bearing Config（利息算出機能）拡張を使って、Mint アカウントに継続的複利の利率を設定・取得・計算する手順を解説しています。主な流れは以下のとおりです。

---

## 1. 概要

* **Interest-Bearing Config 拡張** により、Mint アカウント上に基点利率（basis points）を保持し、ネットワーク時刻に基づいて利息を連続複利で算出可能。
* 実際にトークンを追加発行することなく、UI レイヤーで利息分を「見かけ上」反映する仕組み。

## 2. セットアップ

1. **依存ライブラリの追加**

   ```bash
   npm install @solana/web3.js @solana/spl-token
   ```
2. **Playground（または自前スクリプト）での初期コード**

   * `pg.wallet`（Playground Wallet）を用意し、devnet で SOL をエアドロップ。

## 3. Mint アカウントの作成・初期化

1. **Keypair 生成**

   ```ts
   const mintKeypair = Keypair.generate();
   const mint = mintKeypair.publicKey;
   ```
2. **拡張込みのアカウントサイズ／必要ラムポート取得**

   ```ts
   const mintLen = getMintLen([ExtensionType.InterestBearingConfig]);
   const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
   ```
3. **トランザクション構築**

   * `SystemProgram.createAccount` でアカウントを作成
   * `createInitializeInterestBearingMintInstruction` で利率拡張を初期化
   * `createInitializeMintInstruction` で通常の Mint 初期化
4. **送信**

   ```ts
   const tx = new Transaction().add(
     createAccountInstruction,
     initializeInterestBearingMintInstruction,
     initializeMintInstruction,
   );
   await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair]);
   ```

## 4. 利率の更新

* `updateRateInterestBearingMint` 関数を呼び出し、Rate Authority が新利率（basis points）をセット可能。

```ts
await updateRateInterestBearingMint(
  connection,
  payer,
  mint,
  rateAuthority,
  newRateBasisPoints,
  undefined,
  undefined,
  TOKEN_2022_PROGRAM_ID,
);
```

## 5. 設定状態の取得

* `getMint`→`getInterestBearingMintConfigState` で、現在の利率・最終更新時刻などを JSON で取得。

```ts
const mintAccount = await getMint(connection, mint, undefined, TOKEN_2022_PROGRAM_ID);
const config = await getInterestBearingMintConfigState(mintAccount);
console.log(JSON.stringify(config, null, 2));
```

## 6. 利息の計算

* **オフチェーン計算**
  `uiAmountToAmountForMintWithoutSimulation` で任意のトークン量に対する見かけ上の残高を算出（トランザクション不要）。
* **オンチェーン計算**
  `amountToUiAmount` を使い、シミュレーション付きで同様の計算が可能。

```ts
const uiAmount = await uiAmountToAmountForMintWithoutSimulation(
  connection, mint, amount,
);
```

## 7. 注意点と結論

* ネットワーク時刻のドリフトにより理論値より若干少ない利息算出が起こり得るが稀。
* この拡張により、Token Extensions で伝統的金融の利息機能を再現し、Solana トークンの用途を拡大できる。

---

以上が Interest-Bearing Config 拡張の導入から利息計算までの流れです。
