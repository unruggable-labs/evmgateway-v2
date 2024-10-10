<p align="center">
	<img src="https://raw.githubusercontent.com/unruggable-labs/unruggable-gateways/main/unruggable-logo-black.png" width="300" alt="Unruggable Gateways">
</p>

# Unruggable Gateways 

This repository provides an end-to-end solution for proving data from rollup chains and verifying it against state posted on the parent chain.

![Unruggable Gateways CI](https://github.com/unruggable-labs/unruggable-gateways/actions/workflows/unruggable-gateways.yml/badge.svg)

## Quickstart

`npm i @unruggable/gateways` [&check;](https://www.npmjs.com/package/@unruggable/unruggable-gateways)

* We have extensive [documentation](https://gateway-docs.unruggable.com), with a slightly less quick [Quickstart](https://gateway-docs.unruggable.com/quickstart). 
* The [examples](https://gateway-docs.unruggable.com/examples) page may be of particular interest. 
* We also have an [examples repo](https://github.com/unruggable-labs/gateway-examples) that utilises our npm package to demonstrate both simple and complex use cases in a few clicks.

## Architecture

- **Request** &mdash; a program that fetches data from one or more contracts
	* constructable in [Solidity](./contracts/GatewayFetcher.sol) and [TypeScript](./src/vm.ts) using (almost) the same syntax
- **Commit** &mdash; a commitment (eg. `StateRoot`) of one chain on another
- **VM** &mdash; a machine that executes a **Request** for a **Commit**
	* TypeScript &mdash; records sequence of necessary proofs
	* Solidity &mdash; verifies sequence of supplied proofs (in the same order)
- **Rollup** (TypeScript) &mdash; traverses **Commit** history, generates a **Commit** proof and supplies a **Prover**
- **Prover** (TypeScript) &mdash; generates rollup-specific Account and Storage proofs
- **Gateway** (TypeScript) &mdash; receives a **Request**, finds the appropriate **Commit**, executes the **VM**, and responds with a sequence of proofs via [CCIP-Read](https://eips.ethereum.org/EIPS/eip-3668)
- **Verifier** (Solidity) &mdash; verifies a **Commit** proof and executes the **VM** with **Hooks**
- **Verifier Hooks** (Solidity) &mdash; verifies rollup-specific Account and Storage proofs

## Chain Support
* Rollups &amp; Verifers
	* [OP](./src/op/OPRollup.ts) &mdash; Base, Blast, Celo, Cyber, Fraxtal, Mantle, Mode, opBNB, Redstone, Shape, Zora
	* [OP w/Fault Proofs](./src/op/OPFaultRollup.ts) &mdash; Optimism
	* [Nitro](./src/nitro/NitroRollup.ts) &mdash; Arbitrum One
	* [Linea](./src/linea/LineaRollup.ts)
	* [Polygon PoS](./src/polygon/PolygonPoSRollup.ts)
	* [Polygon ZK](./src/polygon/ZKEVMRollup.ts) &mdash; *WIP*
	* [Scroll](./src/scroll/ScrollRollup.ts)
	* [Taiko](./src/taiko/TaikoRollup.ts)
	* [ZKSync](./src/zksync/ZKSyncRollup.ts)
	* [Reverse OP](./src/op/ReverseOPRollup.ts) &mdash; L2 &rarr; L1 for any Superchain
	* [Self](./src/eth/EthSelfRollup.ts) &mdash; any Chain to itself
* Provers
	* [Eth](./src/eth//EthProver.ts) &mdash; `eth_getProof`
	* [Linea](./src/linea/LineaProver.ts) &mdash; `linea_getProof`
	* [ZKSync](./src/zksync/ZKSyncProver.ts) &mdash; `zks_getProof`
	* [ZKEVM](./src/polygon/ZKEVMProver.ts) &mdash; `zkevm_getProof`
* Verifier Hooks
	* [Eth](./contracts/eth/EthVerifierHooks.sol) &mdash; [Patricia Merkle Tree](./contracts/eth/MerkleTrie.sol)
	* [Linea](./contracts/linea/LineaVerifierHooks.sol) &mdash; [Sparse Merkle Tree](./contracts/linea/SparseMerkleProof.sol) + [Mimc](./contracts/linea/Mimc.sol)
	* [Scroll](./contracts/scroll/ScrollVerifierHooks.sol) &mdash; Binary Merkle Tree + Poseidon
	* [ZKSync](./contracts/zksync/ZKSyncVerifierHooks.sol) &mdash; [Sparse Merkle Tree](./contracts/zksync/ZKSyncSMT.sol) + [Blake2S](./contracts/zksync/Blake2S.sol)

If you are interested in building a solution for another chain, please take a look at our our [Contribution Guidelines](#contribution-guidelines) and/or [get in touch](https://unruggable.com/contact).

## Setup

1. [`foundryup`](https://book.getfoundry.sh/getting-started/installation)
1. `forge install`
1. `bun i`
1. create [`.env`](./.env.example)

## Running a Gateway

* `bun run serve <chain> [port]`
	* Chains: `arb1` `base-testnet` `base` `blast` `celo-alfajores` `cyber` `fraxtal` `lineaV1` `linea` `mantle` `mode` `op` `opbnb` `polygon` `redstone` `reverse-op` `scroll` `self-eth` `self-holesky` `self-sepolia` `shape` `taiko` `zksync` `zora`
	* Default port: `8000`

## Testing

There is an extensive test suite available for testing individual components of the solution in an isolated manner. 

Using [Foundry](https://getfoundry.sh/) and [blocksmith.js](https://github.com/adraffy/blocksmith.js/), we fork the chain in question (such that can interact with contracts deployed on a real network) and then deploy and test against an isolated unit (for example the chain specific verifier).

Commands available include:

* `bun run test`
	* `bun run test-components`
		* [Supported Operations](./test/components/ops.test.ts)
		* [Protocol Limits](./test/components/limits.test.ts)
		* [Batched `eth_getProof`](./test/components/proofs.test.ts)
	* `bun run test-gateways`
		* [Contract](./test/gateway/SlotDataContract.sol) &rarr; [Reader](./test/gateway/SlotDataReader.sol) &rarr; [Tests](./test/gateway/tests.ts)
		* ⚠️ Scroll fails [`readZero()`](./test/gateway/tests.ts#L26) test
		* ⚠️ Polygon has poor `eth_getProof` support

## Examples

A number of examples are provided as part of this repository. For more extensive step-wise example code, please see our [documentation](https://gateway-docs.unruggable.com/examples).

* [linea-ens](./test/v1/linea-ens.ts)
	* Replacement backend demo for https://names.linea.build/
	* `bun serve lineaV1`

## Notes

#### Suggested VSCode Extensions

* [JuanBlanco.solidity](https://marketplace.visualstudio.com/items?itemName=JuanBlanco.solidity)
* [esbenp.prettier-vscode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
* [dbaeumer.vscode-eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

#### Forge Setup
```sh
# installed by forge in step (2)
# provided for reference
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2

# installed by script instead of the following command
# placed at standard remapping location
# see: https://github.com/ethereum-optimism/optimism/issues/10202
#forge install ethereum-optimism/optimism
bun build/import-op.ts
```

## Contribution Guidelines

We welcome contributions to this codebase. 

The premise behind the development of this software is to minimise duplication of effort and provide tooling that allows developers to interface with a simple, standardised API to read data from other chains.

Please take a look at our [CONTRIBUTING.md](https://github.com/unruggable-labs/unruggable-gateways/blob/main/CONTRIBUTING.md) file for a more in depth overview of our contribution process.

## Release Process

### Branching strategy

* [main](https://github.com/unruggable-labs/unruggable-gateways/tree/main) is our stable release branch that reflects the latest release.
* [develop](https://github.com/unruggable-labs/unruggable-gateways/tree/develop) is our ongoing development branch. Feature branches are to merged down into this.
* Feature Branches: Separate branches will be utilised for new feature development or bug fixes.

## License

All files within this repository are licensed under the [MIT License](https://github.com/ethereum-optimism/optimism/blob/master/LICENSE) unless stated otherwise.
