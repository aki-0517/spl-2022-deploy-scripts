#!/usr/bin/env ts-node

import { YieldBearingStablecoinDeployer, STABLECOIN_CONFIGS } from './deploy-yield-bearing-stablecoin';

async function testDeploy() {
  try {
    console.log('🚀 Testing deployment with CLI wallet...');
    
    // Initialize deployer (will use CLI wallet by default)
    const deployer = new YieldBearingStablecoinDeployer();
    console.log(`📋 Using CLI wallet: ${deployer.getPayerPublicKey()}`);
    
    // Check current balance
    console.log('\n💰 Checking current balance...');
    await deployer.requestAirdrop();
    
    // Use USDC-TEST template with small amount
    const config = {
      ...STABLECOIN_CONFIGS.USDC_TEST,
      initialSupply: 1000, // Small test amount
      recipientPublicKey: deployer.getPayerPublicKey(), // Send to CLI wallet
    };
    
    console.log('\n🚀 Starting deployment...');
    const result = await deployer.deploy(config);
    
    console.log('\n🎉 Deployment successful!');
    console.log(`📋 Mint Address: ${result.mintAddress}`);
    console.log(`🔗 Explorer: https://explorer.solana.com/address/${result.mintAddress}?cluster=devnet`);
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testDeploy();
}