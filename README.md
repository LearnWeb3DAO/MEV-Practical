# MEV Practical

In MEV Theory, we understood what MEV is, what Flashbots are, and some use cases of Flashbots. In this level we will learn how to mint an NFT using Flashbots. This is going to be a very simple use case designed to teach you how to use Flashbots, not necessarily make a profit. Finding opportunities where you can make profit using MEV is a hard problem and are typically not public information. Every Searcher is trying to do their best, and if they tell you exactly what strategies they're using, they are shooting themselves in the foot.

This tutorial is just meant to show you how you use Flashbots to send transactions in the first place, the rest is up to you!

## Build

Lets build an example on how to usee flashbots

- To setup a Hardhat project, Open up a terminal and execute these commands

  ```bash
  npm init --yes
  npm install --save-dev hardhat
  ```
  
- If you are on a Windows machine, please do this extra step and install these libraries as well :)

  ```bash
  npm install --save-dev @nomiclabs/hardhat-waffle ethereum-waffle chai @nomiclabs/hardhat-ethers ethers
  ```

- In the same directory where you installed Hardhat run:

  ```bash
  npx hardhat
  ```

  - Select `Create a basic sample project`
  - Press enter for the already specified `Hardhat Project root`
  - Press enter for the question if you want to add a `.gitignore`
  - Press enter for `Do you want to install this sample project's dependencies with npm (@nomiclabs/hardhat-waffle ethereum-waffle chai @nomiclabs/hardhat-ethers ethers)?`

Now you have a hardhat project ready to go!

Let's install a few more dependencies to help us further

```bash
npm install @flashbots/ethers-provider-bundle @openzeppelin/contracts dotenv
```

Let's start off by creating a FakeNFT Contract. Under your contracts folder create a new file named `FakeNFT.sol` and add the following lines of code to it

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract FakeNFT is ERC721 {

    uint256 tokenId = 1;
    uint256 constant price = 0.01 ether;
    constructor() ERC721("FAKE", "FAKE") {
    }

    function mint() public payable {
        require(msg.value == price, "Ether sent is incorrect");
        _mint(msg.sender, tokenId);
        tokenId += 1;
    }
}
```

This is a pretty simple ERC-721 contract that allows minting an NFT for 0.01 ETH.

Now let's replace the code present in `hardhat.config.js` with the following lines of code

```javascript
require("@nomiclabs/hardhat-waffle");
require("dotenv").config({ path: ".env" });

const ALCHEMY_API_KEY_URL = process.env.ALCHEMY_API_KEY_URL;

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: "0.8.4",
  networks: {
    goerli: {
      url: ALCHEMY_API_KEY_URL,
      accounts: [PRIVATE_KEY],
    },
  },
};

```

Note that we are using `goerli` here which is an Ethereum testnet, similar to Rinkeby and Ropsten, but the only one supported by Flashbots.

Now its time to set up some environment variables, create a new file `.env` under your root folder, and add the following lines of code to it. 

```
ALCHEMY_API_KEY_URL="ALCHEMY-API-KEY-URL"
PRIVATE_KEY="YOUR-PRIVATE-KEY"
ALCHEMY_WEBSOCKET_URL="ALCHEMY-WEBSOCKET-URL"
```

To get your `ALCHEMY_API_KEY_URL` and `ALCHEMY_WEBSOCKET_URL` go to [Alchemy](https://www.alchemy.com/), log in and create a new app. Make sure you select `Goerli` under the Network tab

![](https://i.imgur.com/l5H9Whh.png)

Now copy the`HTTP` url and paste it inplace of `ALCHEMY-API-KEY` and copy `WEBSOCKETS` and paste it in place of `ALCHEMY-WEBSOCKET-URL`
![test](https://user-images.githubusercontent.com/35871990/166679948-8e62c5ab-bfed-4d65-9fe2-595328fca964.png)


Replace `YOUR-PRIVATE-KEY` with the private key of an account in which you have Goerli Ether, to get some Goerli ether try out [this faucet](https://goerlifaucet.com/)

Now it's time to write some code that will help us interact with Flashbots.

Create a new file under `scripts` folder and name it `flashbots.js` and add the following lines of code to it

```javascript
const {
  FlashbotsBundleProvider,
} = require("@flashbots/ethers-provider-bundle");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
require("dotenv").config({ path: ".env" });

async function main() {
  // Deploy FakeNFT Contract
  const fakeNFT = await ethers.getContractFactory("FakeNFT");
  const FakeNFT = await fakeNFT.deploy();
  await FakeNFT.deployed();

  console.log("Address of Fake NFT Contract:", FakeNFT.address);

  // Create a Alchemy WebSocket Provider
  const provider = new ethers.providers.WebSocketProvider(
    process.env.ALCHEMY_WEBSOCKET_URL,
    "goerli"
  );

  // Wrap your private key in the ethers Wallet class
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Create a Flashbots Provider which will forward the request to the relayer
  // Which will further send it to the flashbot miner
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    signer,
    // URL for the flashbots relayer
    "https://relay-goerli.flashbots.net",
    "goerli"
  );

  provider.on("block", async (blockNumber) => {
    console.log("Block Number: ", blockNumber);
    // Send a bundle of transactions to the flashbot relayer
    const bundleResponse = await flashbotsProvider.sendBundle(
      [
        {
          transaction: {
            // ChainId for the Goerli network
            chainId: 5,
            // EIP-1559
            type: 2,
            // Value of 1 FakeNFT
            value: ethers.utils.parseEther("0.01"),
            // Address of the FakeNFT
            to: FakeNFT.address,
            // In the data field, we pass the function selctor of the mint function
            data: FakeNFT.interface.getSighash("mint()"),
            // Max Gas Fes you are willing to pay
            maxFeePerGas: BigNumber.from(10).pow(9).mul(3),
            // Max Priority gas fees you are willing to pay
            maxPriorityFeePerGas: BigNumber.from(10).pow(9).mul(2),
          },
          signer: signer,
        },
      ],
      blockNumber + 1
    );

    // If an error is present, log it
    if ("error" in bundleResponse) {
      console.log(bundleResponse.error.message);
    }
  });
}

main();

```

Now let's try to understand what's happening in these lines of code.

In the initial lines of code, we deployed the `FakeNFT` contract which we wrote.

After that we created an Alchemy WebSocket Provider, a signer and a Flashbots provider. Note the reason why we created a WebSocket provider this time is because we want to create a socket to listen to every new block that comes in `Goerli` network. HTTP Providers, as we had been using previously, work on a request-response model, where a client sends a request to a server, and the server responds back. In the case of WebSockets, however, the client opens a connection with the WebSocket server once, and then the server continuously sends them updates as long as the connection remains open. Therefore the client does not need to send requests again and again.

The reason to do that is that all miners in `Goerli` network are not flashbot miners. This means for some blocks it might happen that the bundle of transactions you send dont get included. 

As a reason, we listen for each block and send a request in each block so that when the coinbase miner(miner of the current block) is a flashbots miner, our transaction gets included.


```javascript
// Create a Alchemy WebSocket Provider
  const provider = new ethers.providers.WebSocketProvider(
    process.env.ALCHEMY_WEBSOCKET_URL,
    "goerli"
  );

  // Wrap your private key in the ethers Wallet class
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Create a Flashbots Provider which will forward the request to the relayer
  // Which will further send it to the flashbot miner
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    signer,
    // URL for the goerli flashbots relayer
    "https://relay-goerli.flashbots.net",
    "goerli"
  );
```

After initializing the providers and signers, we use our provider to listen for the `block` event. Every time a `block` event is called, we print the block number and send a bundle of transactions to mint the NFT. Note the bundle we are sending may or may not get included in the current block depending on whether the coinbase miner is a flashbot miner or not.

Now to create the transaction object, we specify the `chainId` which is `5` for Goerli, `type` which is `2` because we will use the `Post-London Upgrade` gas model which is `EIP-1559`. To refresh your memory on how this gas model works, check out the `Gas` module in Sophomore.

We specify `value` which is `0.01` because that's the amount for minting 1 NFT and the `to` address which is the address of `FakeNFT` contract.

Now for `data` we need to specify the function selector which is the first four bytes of the  Keccak-256 (SHA-3) hash of  the name  and the arguments of the function
This will determine which function are we trying to call, in our case, it will be the mint function.

Then we specify the `maxFeePerGas` and `maxPriorityFeePerGas` to be `3 GWEI` and `2 GWEI` respectively. Note the values I got here are from looking at the transactions which were mined previously in the network and what `Gas Fees` were they using.

also,
`1 GWEI = 10*WEI = 10*10^8 = 10^9`

We want the transaction to be mined in the next block, so we add 1 to the current blocknumber and send this bundle of transactions.

After sending the bundle, we get a `bundleResponse` on which we check if there was an error or not, if yes we log it.

Now note, getting a response doesn't guarantee that our bundle will get included in the next block or not. To check if it will get included in the next block or not you can use `bundleResponse.wait()` but for the sake of this tutorial, we will just wait patiently for a few blocks and observe. 

```javascript
  provider.on("block", async (blockNumber) => {
    console.log("Block Number: ", blockNumber);
    // Send a bundle of transactions to the flashbot relayer
    const bundleResponse = await flashbotsProvider.sendBundle(
      [
        {
          transaction: {
            // ChainId for the Goerli network
            chainId: 5,
            // EIP-1559
            type: 2,
            // Value of 1 FakeNFT
            value: ethers.utils.parseEther("0.01"),
            // Address of the FakeNFT
            to: FakeNFT.address,
            // In the data field, we pass the function selctor of the mint function
            data: FakeNFT.interface.getSighash("mint()"),
            // Max Gas Fees you are willing to pay
            maxFeePerGas: BigNumber.from(10).pow(9).mul(3),
            // Max Priority gas fees you are willing to pay
            maxPriorityFeePerGas: BigNumber.from(10).pow(9).mul(2),
          },
          signer: signer,
        },
      ],
      blockNumber + 1
    );

    // If an error is present, log it
    if ("error" in bundleResponse) {
      console.log(bundleResponse.error.message);
    }
  });
```

Now to run this code, in your terminal pointing to the root directory execute the following command:

```bash
npx hardhat run scripts/flashbots.js --network goerli
```

After an address is printed on your terminal, go to [Goerli Etherscan](https://goerli.etherscan.io/) and keep refreshing the page till you see `Mint` transaction appear(Note it takes some time for it to appear cause the flashbot miner has to be the coinbase miner for our bundle to be included in the block)

![](https://i.imgur.com/sVwacVp.png)


![](https://i.imgur.com/Aawg5gK.png)



Boom 🤯 We now learned how to use flashbots to mint a NFT but you can do so much more 👀


GG 🥳

## Readings
- [Flashbots Docs](https://docs.flashbots.net/)
- [Arbitrage bot using Flashbots](https://github.com/flashbots/simple-arbitrage)
