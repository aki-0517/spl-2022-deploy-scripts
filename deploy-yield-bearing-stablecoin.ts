import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import {
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createInitializeInterestBearingMintInstruction,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  mintTo,
  getMint,
  getInterestBearingMintConfigState,
  updateRateInterestBearingMint,
} from "@solana/spl-token";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface DeploymentConfig {
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  initialSupply: number;
  interestRateBasisPoints: number;
  rateAuthorityPublicKey?: string;
  mintAuthorityPublicKey?: string;
  recipientPublicKey?: string;
}

interface DeploymentResult {
  mintAddress: string;
  transactionSignatures: string[];
  config: any;
  deploymentTime: string;
}

/**
 * Load CLI wallet keypair from default Solana config
 */
function loadCliWallet(): Keypair {
  const configPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`CLI wallet not found at ${configPath}. Run 'solana-keygen new' first.`);
  }
  
  const keyData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(keyData));
}

/**
 * Deploy a yield-bearing stablecoin test token to Solana devnet
 */
export class YieldBearingStablecoinDeployer {
  private connection: Connection;
  private payer: Keypair;

  constructor(payerKeypair?: Keypair) {
    this.connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    this.payer = payerKeypair || loadCliWallet();
  }

  /**
   * Deploy yield-bearing stablecoin with specified parameters
   */
  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    console.log(`🚀 Deploying ${config.tokenName} (${config.tokenSymbol}) to devnet...`);
    
    const signatures: string[] = [];
    const mintKeypair = Keypair.generate();
    const mintPubkey = mintKeypair.publicKey;

    // Set authorities (default to payer if not specified)
    const mintAuthority = config.mintAuthorityPublicKey 
      ? new PublicKey(config.mintAuthorityPublicKey) 
      : this.payer.publicKey;
    
    const rateAuthority = config.rateAuthorityPublicKey 
      ? new PublicKey(config.rateAuthorityPublicKey) 
      : this.payer.publicKey;

    try {
      // Step 1: Create Interest-Bearing Mint Account
      console.log("📝 Creating Interest-Bearing Mint Account...");
      const createMintSignature = await this.createInterestBearingMint(
        mintKeypair,
        config.decimals,
        mintAuthority,
        rateAuthority,
        config.interestRateBasisPoints
      );
      signatures.push(createMintSignature);
      console.log(`✅ Mint created: ${mintPubkey.toBase58()}`);

      // Step 2: Mint initial supply (if specified and recipient provided)
      if (config.initialSupply > 0) {
        const recipient = config.recipientPublicKey 
          ? new PublicKey(config.recipientPublicKey) 
          : this.payer.publicKey;

        console.log(`💰 Minting ${config.initialSupply} tokens to ${recipient.toBase58()}...`);
        const mintTokensSignature = await this.mintTokens(
          mintPubkey,
          recipient,
          config.initialSupply * Math.pow(10, config.decimals),
          mintAuthority
        );
        signatures.push(mintTokensSignature);
        console.log(`✅ Minted ${config.initialSupply} tokens`);
      }

      // Step 3: Get final configuration
      console.log("📊 Retrieving mint configuration...");
      const mintAccount = await getMint(this.connection, mintPubkey, undefined, TOKEN_2022_PROGRAM_ID);
      const interestConfig = await getInterestBearingMintConfigState(mintAccount);

      const result: DeploymentResult = {
        mintAddress: mintPubkey.toBase58(),
        transactionSignatures: signatures,
        config: {
          tokenName: config.tokenName,
          tokenSymbol: config.tokenSymbol,
          decimals: config.decimals,
          mintAuthority: mintAuthority.toBase58(),
          rateAuthority: rateAuthority.toBase58(),
          interestRateBasisPoints: interestConfig ? Number(interestConfig.currentRate) : config.interestRateBasisPoints,
          initialSupply: config.initialSupply,
          totalSupply: mintAccount.supply.toString(),
          lastUpdateTimestamp: interestConfig ? Number(interestConfig.lastUpdateTimestamp) : Date.now(),
        },
        deploymentTime: new Date().toISOString(),
      };

      // Save deployment info to file
      await this.saveDeploymentInfo(result);

      console.log("🎉 Deployment completed successfully!");
      console.log(`📋 Mint Address: ${result.mintAddress}`);
      console.log(`💫 Interest Rate: ${config.interestRateBasisPoints / 100}%`);
      
      return result;

    } catch (error) {
      console.error("❌ Deployment failed:", error);
      throw error;
    }
  }

  private async createInterestBearingMint(
    mintKeypair: Keypair,
    decimals: number,
    mintAuthority: PublicKey,
    rateAuthority: PublicKey,
    interestRateBasisPoints: number
  ): Promise<string> {
    // Calculate account size and rent
    const mintLen = getMintLen([ExtensionType.InterestBearingConfig]);
    const lamports = await this.connection.getMinimumBalanceForRentExemption(mintLen);

    // Create account instruction
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: this.payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    });

    // Initialize Interest-Bearing extension
    const initInterestBearingInstruction = createInitializeInterestBearingMintInstruction(
      mintKeypair.publicKey,
      rateAuthority,
      interestRateBasisPoints,
      TOKEN_2022_PROGRAM_ID
    );

    // Initialize mint
    const initMintInstruction = createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      mintAuthority,
      null, // freeze authority
      TOKEN_2022_PROGRAM_ID
    );

    // Create and send transaction
    const transaction = new Transaction().add(
      createAccountInstruction,
      initInterestBearingInstruction,
      initMintInstruction
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer, mintKeypair]
    );

    return signature;
  }

  private async mintTokens(
    mintPubkey: PublicKey,
    recipient: PublicKey,
    amount: number,
    mintAuthority: PublicKey
  ): Promise<string> {
    // Get or create associated token account
    const recipientAta = await getAssociatedTokenAddress(
      mintPubkey,
      recipient,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const transaction = new Transaction();

    // Check if ATA exists, if not create it
    const accountInfo = await this.connection.getAccountInfo(recipientAta);
    if (!accountInfo) {
      const createAtaInstruction = createAssociatedTokenAccountInstruction(
        this.payer.publicKey,
        recipientAta,
        recipient,
        mintPubkey,
        TOKEN_2022_PROGRAM_ID
      );
      transaction.add(createAtaInstruction);
    }

    // Send transaction to create ATA if needed
    if (transaction.instructions.length > 0) {
      await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.payer]
      );
    }

    // Mint tokens
    const signature = await mintTo(
      this.connection,
      this.payer,
      mintPubkey,
      recipientAta,
      mintAuthority,
      amount,
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    return signature;
  }

  /**
   * Update interest rate for an existing mint
   */
  async updateInterestRate(
    mintAddress: string,
    newRateBasisPoints: number,
    rateAuthority?: Keypair
  ): Promise<string> {
    const mintPubkey = new PublicKey(mintAddress);
    const authority = rateAuthority || this.payer;

    const signature = await updateRateInterestBearingMint(
      this.connection,
      this.payer,
      mintPubkey,
      authority,
      newRateBasisPoints,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    console.log(`📈 Interest rate updated to ${newRateBasisPoints / 100}%`);
    return signature;
  }

  private async saveDeploymentInfo(result: DeploymentResult): Promise<void> {
    const deploymentDir = path.join(__dirname, 'deployments');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const filename = `${result.config.tokenSymbol}_${Date.now()}.json`;
    const filepath = path.join(deploymentDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`💾 Deployment info saved to: ${filepath}`);
  }

  /**
   * Get payer's public key for reference
   */
  getPayerPublicKey(): string {
    return this.payer.publicKey.toBase58();
  }

  /**
   * Request devnet SOL airdrop for the payer
   */
  async requestAirdrop(lamports: number = 2000000000): Promise<string | null> {
    try {
      // Check current balance first
      const currentBalance = await this.connection.getBalance(this.payer.publicKey);
      const currentSOL = currentBalance / 1e9;
      const requestedSOL = lamports / 1e9;
      
      console.log(`💰 Current balance: ${currentSOL.toFixed(4)} SOL`);
      
      // If we already have enough SOL, skip airdrop
      if (currentBalance >= lamports) {
        console.log(`✅ Sufficient SOL balance (${currentSOL.toFixed(4)} SOL). Skipping airdrop.`);
        return null;
      }
      
      console.log(`💧 Requesting ${requestedSOL} SOL airdrop...`);
      const signature = await this.connection.requestAirdrop(this.payer.publicKey, lamports);
      await this.connection.confirmTransaction(signature);
      
      const newBalance = await this.connection.getBalance(this.payer.publicKey);
      console.log(`✅ Airdrop completed: ${signature} (New balance: ${(newBalance / 1e9).toFixed(4)} SOL)`);
      return signature;
    } catch (error) {
      console.log(`⚠️  Airdrop failed (${error instanceof Error ? error.message : 'Unknown error'}), continuing with existing balance...`);
      const currentBalance = await this.connection.getBalance(this.payer.publicKey);
      console.log(`💰 Current balance: ${(currentBalance / 1e9).toFixed(4)} SOL`);
      return null;
    }
  }
}

// Export default configuration templates
export const STABLECOIN_CONFIGS = {
  USDC_TEST: {
    tokenName: "USD Coin Test",
    tokenSymbol: "USDC-TEST",
    decimals: 6,
    initialSupply: 1000000, // 1M tokens
    interestRateBasisPoints: 500, // 5% APY
  },
  USDT_TEST: {
    tokenName: "Tether Test",
    tokenSymbol: "USDT-TEST", 
    decimals: 6,
    initialSupply: 500000, // 500K tokens
    interestRateBasisPoints: 300, // 3% APY
  },
  DAI_TEST: {
    tokenName: "Dai Stablecoin Test",
    tokenSymbol: "DAI-TEST",
    decimals: 18,
    initialSupply: 100000, // 100K tokens
    interestRateBasisPoints: 400, // 4% APY
  },
} as const;