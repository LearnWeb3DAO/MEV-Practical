const {
  FlashbotsBundleProvider,
} = require("@flashbots/ethers-provider-bundle");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
require("dotenv").config({ path: ".env" });

async function main() {
  const fakeNFT = await ethers.getContractFactory("FakeNFT");
  const FakeNFT = await fakeNFT.deploy();
  await FakeNFT.deployed();
  console.log(FakeNFT.address);
  const provider = new ethers.providers.getDefaultProvider("goerli");

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    signer,
    "https://relay-goerli.flashbots.net",
    "goerli"
  );
  console.log(await provider.getBlockNumber());
  const interface = FakeNFT.interface;
  while (true) {
    const blockNumber = (await provider.getBlockNumber()) + 1;
    await flashbotsProvider.sendBundle(
      [
        {
          transaction: {
            chainId: 5,
            type: 2,
            value: ethers.utils.parseEther("0.01"),
            to: FakeNFT.address,
            data: interface.getSighash("mint"),
            maxFeePerGas: BigNumber.from(10).pow(9).mul(3),
            maxPriorityFeePerGas: BigNumber.from(10).pow(9).mul(2),
          },
          signer: signer,
        },
      ],
      blockNumber
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
