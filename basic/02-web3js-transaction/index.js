const Web3 = require('web3');
const fs = require('fs');
const contractOfIncrementer = require('./compile');

require('dotenv').config();
const privatekey = process.env.PRIVATE_KEY;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
   -- Define Provider --
*/
// Provider
const providerRPC = {
  development: 'https://sepolia.infura.io/v3/' + process.env.INFURA_ID,
  moonbase: 'https://rpc.testnet.moonbeam.network',
};
const web3 = new Web3(providerRPC.development); //Change to correct network

// Create account with privatekey
const account = web3.eth.accounts.privateKeyToAccount(privatekey);
const account_from = {
  privateKey: privatekey,
  accountAddress: account.address,
};

// Get abi & bin
const bytecode = contractOfIncrementer.evm.bytecode.object;
const abi = contractOfIncrementer.abi;

/*
*
*
*   -- Verify Deployment --
*

*/
const Trans = async () => {
  console.log('============================ 1. Deploy Contract');
  console.log(`Attempting to deploy from account ${account.address}`);

  // Create Contract Instance
  const deployContract = new web3.eth.Contract(abi);

  // Create Deployment Tx
  const deployTx = deployContract.deploy({
    data: bytecode,
    arguments: [5],
  });

  // Sign Tx
  const createTransaction = await web3.eth.accounts.signTransaction(
    {
      data: deployTx.encodeABI(),
      gas: 8000000,
    },
    account_from.privateKey
  );

  // Get Transaction Receipt
  const createReceipt = await web3.eth.sendSignedTransaction(
    createTransaction.rawTransaction
  );
  console.log(`Contract deployed at address: ${createReceipt.contractAddress}`);
  // Contract deployed at address: 0xFe3bb59414909964605125522CCDaD28a78C9b86 (sepolia测试网)

  const deployedBlockNumber = createReceipt.blockNumber;

  /*
   *
   *
   *
   * -- Verify Interface of Increment --
   *
   *
   */
  // Create the contract with contract address
  console.log();
  console.log(
    '============================ 2. Call Contract Interface getNumber'
  );
  let incrementer = new web3.eth.Contract(abi, createReceipt.contractAddress);

  console.log(
    `Making a call to contract at address: ${createReceipt.contractAddress}`
  );

  let number = await incrementer.methods.getNumber().call();
  console.log(`The current number stored is: ${number}`);
  // The current number stored is: 5

  // Add 3 to Contract Public Variable
  console.log();
  console.log(
    '============================ 3. Call Contract Interface increment'
  );
  const _value = 3;
  let incrementTx = incrementer.methods.increment(_value);

  // Sign with Pk
  let incrementTransaction = await web3.eth.accounts.signTransaction(
    {
      to: createReceipt.contractAddress,
      data: incrementTx.encodeABI(),
      gas: 8000000,
    },
    account_from.privateKey
  );

  // Send Transactoin and Get TransactionHash
  const incrementReceipt = await web3.eth.sendSignedTransaction(
    incrementTransaction.rawTransaction
  );
  console.log(`Tx successful with hash: ${incrementReceipt.transactionHash}`);
  // Tx successful with hash: 0x0b01e22204eb09902ee1b092dca7a98172178067be9d7872fb648b9cd440ed75

  number = await incrementer.methods.getNumber().call();
  console.log(`After increment, the current number stored is: ${number}`);
  // After increment, the current number stored is: 8

  /*
   *
   *
   *
   * -- Verify Interface of Reset --
   *
   *
   */
  console.log();
  console.log('============================ 4. Call Contract Interface reset');
  const resetTx = incrementer.methods.reset();

  const resetTransaction = await web3.eth.accounts.signTransaction(
    {
      to: createReceipt.contractAddress,
      data: resetTx.encodeABI(),
      gas: 8000000,
    },
    account_from.privateKey
  );

  const resetcReceipt = await web3.eth.sendSignedTransaction(
    resetTransaction.rawTransaction
  );
  console.log(`Tx successful with hash: ${resetcReceipt.transactionHash}`);
  // Tx successful with hash: 0x92dc739529be7266c907b20098252189d90c4b9c4587cc0feed5a168119d394e
  number = await incrementer.methods.getNumber().call();
  console.log(`After reset, the current number stored is: ${number}`);
  // After reset, the current number stored is: 0

  /*
   *
   *
   *
   * -- Listen to Event Increment --
   *
   *
   */
  console.log();
  console.log('============================ 5. Listen to Events');
  console.log(' Listen to Increment Event only once && continuouslly');

  // sepolia don't support http protocol to event listen, need to use websocket
  // more details , please refer to  https://medium.com/blockcentric/listening-for-smart-contract-events-on-public-blockchains-fdb5a8ac8b9a
  const web3Socket = new Web3(
    'wss://sepolia.infura.io/ws/v3/' + process.env.INFURA_ID
  );

  // listen to  Increment event only once
  incrementer.once('Increment', (error, event) => {
    console.log('I am a onetime event listner, I am going to die now');
  });

  // listen to Increment event continuously
  web3Socket.eth.subscribe('logs', {
    address: createReceipt.contractAddress,
    topics: []
  }, (error, result) => {
    if (error) {
      console.error(error)
    }
  }
  ).on("data", (event) => {
    console.log("New event: ", event);
  })
    .on("error", (error) => {
      console.error("Error: ", error);
    });

  for (let step = 0; step < 3; step++) {
    incrementTransaction = await web3.eth.accounts.signTransaction(
      {
        to: createReceipt.contractAddress,
        data: incrementTx.encodeABI(),
        gas: 8000000,
      },
      account_from.privateKey
    );

    await web3.eth.sendSignedTransaction(incrementTransaction.rawTransaction);

    console.log("Waiting for events")
    await sleep(3000);

    if (step == 2) {
      // clear all the listeners
      web3Socket.eth.clearSubscriptions();
      console.log('Clearing all the events listeners !!!!');
    }
  }

  /*
   *
   *
   *
   * -- Get past events --
   *
   *
   */
  console.log();
  console.log('============================ 6. Going to get past events');
  const pastEvents = await incrementer.getPastEvents('Increment', {
    fromBlock: deployedBlockNumber,
    toBlock: 'latest',
  });

  pastEvents.map((event) => {
    console.log(event);
  });

  /*
   *
   *
   *
   * -- Check Transaction Error --
   *
   *
   */
  console.log();
  console.log('============================ 7. Check the transaction error');
  incrementTx = incrementer.methods.increment(0);
  incrementTransaction = await web3.eth.accounts.signTransaction(
    {
      to: createReceipt.contractAddress,
      data: incrementTx.encodeABI(),
      gas: 8000000,
    },
    account_from.privateKey
  );

  await web3.eth
    .sendSignedTransaction(incrementTransaction.rawTransaction)
    .on('error', console.error);
};

Trans()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
