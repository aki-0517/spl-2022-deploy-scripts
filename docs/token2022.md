以下では、Solana Token-2022 プログラムにおける Interest-Bearing（利回り付与）拡張の概要と実装手順、主要な API、および開発上のベストプラクティスをまとめます。Interest-Bearing 拡張では、ミント段階で利率を設定し、その後ブロックチェーンのタイムスタンプに基づいてトークン残高が自動的に複利計算されます。実装には標準の `@solana/spl-token`（Token-2022 プログラム）を用い、Rate Authority による利率更新や、`AmountToUiAmount` インストラクションによる UI 表示もサポートされています。

---

## 概要

Token-2022 プログラムは SPL Token の次世代基盤であり、さまざまな「拡張（Extensions）」をサポートします。その一つが **Interest-Bearing Tokens** 拡張で、トークンミントに直接利率を紐づけ、自動的に利息を累積できる仕組みです ([solana.com][1])。

### Interest-Bearing 拡張とは

* **利率設定**：Mint アカウントに `InterestBearingConfig` 拡張を付与し、basis points（bp）単位で年率を設定 ([solana.com][1])。
* **複利計算**：ネットワークタイムスタンプに基づき、連続複利でインデックスを更新。常に最新の残高を算出可能 ([solana.com][2])。
* **UI 連携**：`AmountToUiAmount` / `UiAmountToAmount` 命令で、raw amount と UI 用 amount を相互変換し、ウォレット等で利回りが見える化される ([blog.offside.io][3])。

---

## 実装手順

### 1. 環境準備

```bash
npm init -y  
npm install @solana/web3.js@1 @solana/spl-token @solana-developers/helpers typescript dotenv
```

上記パッケージ群で Token-2022 プログラムおよび SPL Token 操作用の CLI/SDK を揃えます ([solana.com][2])。

### 2. Interest-Bearing Mint の初期化

```ts
import {
  createInitializeInterestBearingMintInstruction,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction
} from "@solana/spl-token";

// ミントアカウント作成済みの Keypair を mintKeypair とする
const rateAuthority = payer;              // 利率変更権限アカウント
const rateBp = 500;                       // 5.00% を basis points で指定
const decimals = 6;                       // USDC 等の小数桁

const ix1 = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: mintKeypair.publicKey,
  space: mintLen,
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});
const ix2 = createInitializeInterestBearingMintInstruction(
  mintKeypair.publicKey,
  rateAuthority.publicKey,
  rateBp,
  TOKEN_2022_PROGRAM_ID
);
const ix3 = createInitializeMintInstruction(
  mintKeypair.publicKey,
  decimals,
  payer.publicKey,
  null,
  TOKEN_2022_PROGRAM_ID
);
```

* `ix2` で利率（500bp = 5%）を設定する ([solana.com][1])。
* `ix3` は通常の Mint 初期化と同様ですが、Token-2022 プログラム ID を渡します ([solana.com][1])。

### 3. 利率の更新

Rate Authority はいつでも以下で利率を変更できます。

```ts
const newRateBp = 750; // 7.50%
const tx = await updateRateInterestBearingMint(
  connection,
  payer,
  mintPubkey,
  rateAuthority,
  newRateBp
);
```

上記 API で `InterestBearingConfig` の `rate` フィールドを書き換え、以降の利息計算に反映されます ([solana.com][1])。

---

## 利息の取得と UI 表示

### 1. 累積利息の取得

```ts
import { getMint, getInterestBearingMintConfigState } from "@solana/spl-token";

const mintAccount = await getMint(connection, mintPubkey, undefined, TOKEN_2022_PROGRAM_ID);
const config = await getInterestBearingMintConfigState(connection, mintPubkey, TOKEN_2022_PROGRAM_ID);
console.log("Current Rate (bp):", config.rate.toNumber());
```

* `config.rate` が現在の利率（basis points）を返却 ([solana.com][1])。

### 2. UI 用残高変換

```ts
import { amountToUiAmount } from "@solana/spl-token";

const rawAmount = new BN(1_000_000); // 1 USDC (6 decimals)
const uiAmount = await amountToUiAmount(
  connection,
  mintPubkey,
  rawAmount,
  TOKEN_2022_PROGRAM_ID
);
console.log("Amount with interest:", uiAmount.toString());
```

`amountToUiAmount` が最新の複利インデックスを適用し、ユーザーが利息込みの残高を確認できます ([neodyme.io][4])。

---

## ベストプラクティス・注意点

* **Rate Authority 管理**：利率変更権限は信頼できるアカウントに限定し、マルチシグ導入も検討する ([blog.bcas.io][5])。
* **タイムスタンプ誤差**：Solana のタイムスタンプドリフトが極稀に累積利息に微差を生む可能性あり（ネットワーク負荷時など） ([neodyme.io][4])。
* **UI 表示のみ**：Phantom など一部ウォレットでは「見せかけ」の利率表示に留まり、実際にミント量が増加しない場合もあるため実装確認を要する ([docs.phantom.com][6])。
* **監査状況**：Token-2022 はまだセキュリティ監査中の機能があるため、本番導入前に各実装の監査状況を確認する ([quicknode.com][7])。

---

## 参考文献

1. Solana Labs – Token Extensions: Interest-Bearing Tokens (公式ガイド) ([solana.com][1])
2. Solana Labs – Interest Bearing Token Lab (開発者コース) ([solana.com][2])
3. QuickNode – What are Solana SPL Token Extensions? ([quicknode.com][7])
4. offside.io – Token-2022 Security Best Practices: Extensions ([blog.offside.io][3])
5. Bcas.io – Solana Token Extensions and Legal Implications ([blog.bcas.io][5])
6. Phantom Developer Docs – Solana Token-2022 ([docs.phantom.com][6])
7. neodyme.io – SPL Token-2022: Don’t shoot yourself in the foot with extensions ([neodyme.io][4])
8. Anchor Lang – Token Extensions in Anchor Programs ([anchor-lang.com][8])
9. Solana Foundation GitHub – Token-2022 Getting Started Guide ([github.com][9])
10. Bitbond – Sol Token Creator: Token-2022 Overview ([bitbond.com][10])

[1]: https://solana.com/developers/guides/token-extensions/interest-bearing-tokens?utm_source=chatgpt.com "Token Extensions: Interest-Bearing - Solana"
[2]: https://solana.com/developers/courses/token-extensions/interest-bearing-token?utm_source=chatgpt.com "Interest Bearing Token - Solana"
[3]: https://blog.offside.io/p/token-2022-security-best-practices-part-2?utm_source=chatgpt.com "Token-2022 Security Best Practices - Part 2: Extensions"
[4]: https://neodyme.io/en/blog/token-2022?utm_source=chatgpt.com "SPL Token-2022: Don't shoot yourself in the foot with extensions"
[5]: https://blog.bcas.io/solana-token-extensions-and-its-legal-implications?utm_source=chatgpt.com "Solana Token Extensions and its Legal Implications - Blog"
[6]: https://docs.phantom.com/developer-powertools/solana-token-extensions-token22?utm_source=chatgpt.com "Solana Token Extensions (Token22) - Phantom Developer Docs"
[7]: https://www.quicknode.com/guides/solana-development/spl-tokens/token-2022/overview?utm_source=chatgpt.com "What are Solana SPL Token Extensions and How to Get Started?"
[8]: https://www.anchor-lang.com/docs/tokens/extensions?utm_source=chatgpt.com "Extensions"
[9]: https://github.com/solana-foundation/developer-content/blob/main/content/guides/token-extensions/getting-started.md?plain=1&utm_source=chatgpt.com "developer-content/content/guides/token-extensions/getting-started ..."
[10]: https://www.bitbond.com/resources/sol-token-creator-unlocking-tokenization-on-solana/?utm_source=chatgpt.com "Sol Token Creator: Unlocking Tokenization On Solana - Bitbond"
