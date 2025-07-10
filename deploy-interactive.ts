#!/usr/bin/env ts-node

import { YieldBearingStablecoinDeployer, STABLECOIN_CONFIGS } from './deploy-yield-bearing-stablecoin';
import * as readline from 'readline';

interface UserInputs {
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  initialSupply: number;
  interestRateBasisPoints: number;
  recipientPublicKey?: string;
  useTemplate?: keyof typeof STABLECOIN_CONFIGS;
}

class InteractiveDeployer {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  private async selectTemplate(): Promise<keyof typeof STABLECOIN_CONFIGS | null> {
    console.log('\n📋 Available templates:');
    console.log('1. USDC-TEST (USD Coin Test - 6 decimals, 5% APY)');
    console.log('2. USDT-TEST (Tether Test - 6 decimals, 3% APY)');
    console.log('3. DAI-TEST (Dai Stablecoin Test - 18 decimals, 4% APY)');
    console.log('4. Custom configuration');

    const choice = await this.ask('\nSelect template (1-4): ');
    
    switch (choice.trim()) {
      case '1': return 'USDC_TEST';
      case '2': return 'USDT_TEST';
      case '3': return 'DAI_TEST';
      case '4': return null;
      default:
        console.log('❌ Invalid choice, using custom configuration');
        return null;
    }
  }

  private async getCustomInputs(): Promise<UserInputs> {
    console.log('\n🔧 Custom Token Configuration');
    
    const tokenName = await this.ask('Token Name (e.g., "My Stablecoin"): ');
    const tokenSymbol = await this.ask('Token Symbol (e.g., "MSC"): ');
    
    const decimalsStr = await this.ask('Decimals (6 for USDC-style, 18 for ETH-style) [default: 6]: ');
    const decimals = decimalsStr.trim() ? parseInt(decimalsStr) : 6;
    
    const initialSupplyStr = await this.ask('Initial Supply (number of tokens) [default: 1000000]: ');
    const initialSupply = initialSupplyStr.trim() ? parseFloat(initialSupplyStr) : 1000000;
    
    const interestRateStr = await this.ask('Interest Rate (% APY, e.g., 5 for 5%) [default: 5]: ');
    const interestRatePercent = interestRateStr.trim() ? parseFloat(interestRateStr) : 5;
    const interestRateBasisPoints = Math.round(interestRatePercent * 100);

    const recipientPublicKey = await this.ask('Recipient Public Key (leave empty to use deployer wallet): ');

    return {
      tokenName: tokenName.trim() || 'Test Stablecoin',
      tokenSymbol: tokenSymbol.trim() || 'TSC',
      decimals,
      initialSupply,
      interestRateBasisPoints,
      recipientPublicKey: recipientPublicKey.trim() || undefined,
    };
  }

  private async getTemplateInputs(templateKey: keyof typeof STABLECOIN_CONFIGS): Promise<UserInputs> {
    const template = STABLECOIN_CONFIGS[templateKey];
    console.log(`\n📝 Using template: ${template.tokenName}`);
    console.log(`   Symbol: ${template.tokenSymbol}`);
    console.log(`   Decimals: ${template.decimals}`);
    console.log(`   Default Supply: ${template.initialSupply}`);
    console.log(`   Interest Rate: ${template.interestRateBasisPoints / 100}%`);

    const useDefaults = await this.ask('\nUse default values? (y/n) [default: y]: ');
    
    if (useDefaults.toLowerCase() === 'n' || useDefaults.toLowerCase() === 'no') {
      const initialSupplyStr = await this.ask(`Initial Supply [default: ${template.initialSupply}]: `);
      const initialSupply = initialSupplyStr.trim() ? parseFloat(initialSupplyStr) : template.initialSupply;
      
      const interestRateStr = await this.ask(`Interest Rate (% APY) [default: ${template.interestRateBasisPoints / 100}]: `);
      const interestRatePercent = interestRateStr.trim() ? parseFloat(interestRateStr) : template.interestRateBasisPoints / 100;
      const interestRateBasisPoints = Math.round(interestRatePercent * 100);

      const recipientPublicKey = await this.ask('Recipient Public Key (leave empty to use deployer wallet): ');

      return {
        ...template,
        initialSupply,
        interestRateBasisPoints,
        recipientPublicKey: recipientPublicKey.trim() || undefined,
      };
    }

    const recipientPublicKey = await this.ask('Recipient Public Key (leave empty to use deployer wallet): ');

    return {
      ...template,
      recipientPublicKey: recipientPublicKey.trim() || undefined,
    };
  }

  async run(): Promise<void> {
    try {
      console.log('🚀 Welcome to Yield-Bearing Stablecoin Deployer');
      console.log('📍 Target Network: Solana Devnet');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Select template or custom
      const templateKey = await this.selectTemplate();
      
      // Get configuration
      const config = templateKey 
        ? await this.getTemplateInputs(templateKey)
        : await this.getCustomInputs();

      // Confirm configuration
      console.log('\n📊 Deployment Configuration:');
      console.log(`   Token: ${config.tokenName} (${config.tokenSymbol})`);
      console.log(`   Decimals: ${config.decimals}`);
      console.log(`   Initial Supply: ${config.initialSupply} tokens`);
      console.log(`   Interest Rate: ${config.interestRateBasisPoints / 100}% APY`);
      console.log(`   Recipient: ${config.recipientPublicKey || 'Deployer wallet'}`);

      const confirm = await this.ask('\nProceed with deployment? (y/n): ');
      if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        console.log('❌ Deployment cancelled');
        return;
      }

      // Initialize deployer
      console.log('\n🔑 Initializing deployer wallet...');
      const deployer = new YieldBearingStablecoinDeployer();
      console.log(`   Deployer Public Key: ${deployer.getPayerPublicKey()}`);

      // Request airdrop
      const needAirdrop = await this.ask('Request SOL airdrop for deployment? (y/n) [default: y]: ');
      if (needAirdrop.toLowerCase() !== 'n' && needAirdrop.toLowerCase() !== 'no') {
        await deployer.requestAirdrop();
      }

      // Deploy token
      console.log('\n🚀 Starting deployment...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const result = await deployer.deploy(config);

      console.log('\n🎉 Deployment Successful!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 Mint Address: ${result.mintAddress}`);
      console.log(`🔗 Solana Explorer: https://explorer.solana.com/address/${result.mintAddress}?cluster=devnet`);
      console.log(`📊 Transaction Signatures:`);
      result.transactionSignatures.forEach((sig, index) => {
        console.log(`   ${index + 1}. https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      });

      // Ask if user wants to update interest rate
      const updateRate = await this.ask('\nWould you like to update the interest rate? (y/n): ');
      if (updateRate.toLowerCase() === 'y' || updateRate.toLowerCase() === 'yes') {
        const newRateStr = await this.ask('New interest rate (% APY): ');
        const newRate = parseFloat(newRateStr);
        if (!isNaN(newRate)) {
          const newRateBasisPoints = Math.round(newRate * 100);
          console.log(`\n📈 Updating interest rate to ${newRate}%...`);
          const updateSig = await deployer.updateInterestRate(result.mintAddress, newRateBasisPoints);
          console.log(`✅ Rate updated: https://explorer.solana.com/tx/${updateSig}?cluster=devnet`);
        }
      }

      console.log('\n💫 Deployment completed successfully!');
      console.log('   You can now use this token in your applications.');
      console.log('   Deployment details have been saved to the deployments folder.');

    } catch (error) {
      console.error('\n❌ Error during deployment:', error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const deployer = new InteractiveDeployer();
  deployer.run().catch(console.error);
}