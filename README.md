<p align="center">
	<img src="https://raw.githubusercontent.com/unruggable-labs/unruggable-gateways/main/unruggable-logo-black.png" width="300" alt="Unruggable Gateways">
</p>

# Unruggable Gateways 

This repository provides an end-to-end solution for proving data from rollup chains and verifying it against state posted on the parent chain.

![Unruggable Gateways CI](https://github.com/unruggable-labs/unruggable-gateways/actions/workflows/unruggable-gateways.yml/badge.svg)

## Audits

The codebase has been audited. Details of our audits can be found [here](./audits/audits.md).

## Quickstart

`npm i @unruggable/gateways` [&check;](https://www.npmjs.com/package/@unruggable/gateways)

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
	* [Superchain](./src/op/OPRollup.ts)
	* [Superchain w/Fault Proofs](./src/op/OPFaultRollup.ts)
	* Arbitrum: [Nitro](./src/arbitrum/NitroRollup.ts) and [BoLD](./src/arbitrum/BoLDRollup.ts)
	* [Linea](./src/linea/LineaRollup.ts) (and [Unfinalized](./src/linea/UnfinalizedLineaRollup.ts))
	* [Polygon PoS](./src/polygon/PolygonPoSRollup.ts)
	* [Scroll](./src/scroll/ScrollRollup.ts) and [Euclid](./src/scroll/EuclidRollup.ts)
	* [Taiko](./src/taiko/TaikoRollup.ts)
	* [ZKSync](./src/zksync/ZKSyncRollup.ts)
	* [Reverse OP](./src/op/ReverseOPRollup.ts) &mdash; L2 &rarr; L1
	* [Self](./src/eth/EthSelfRollup.ts) &mdash; any &rarr; itself
	* [Trusted](./src/TrustedRollup.ts) &mdash; any &rarr; any
	* [Unchecked](./src/UncheckedRollup.ts) &mdash; any &rarr; any
	* [DoubleArbitrum](./src/arbitrum/DoubleArbitrumRollup.ts) &mdash; L1 &rarr; L2 &rarr; L3
	* [Polygon ZK](./src/polygon/ZKEVMRollup.ts) &mdash; *WIP*
	* [Morph](./src/morph/MorphRollup.ts) &mdash; *WIP*
	* [Starknet](./src/starknet/StarknetRollup.ts) &mdash; *WIP*
* Provers
	* [Eth](./src/eth//EthProver.ts) &mdash; `eth_getProof`
	* [Linea](./src/linea/LineaProver.ts) &mdash; `linea_getProof`
	* [ZKSync](./src/zksync/ZKSyncProver.ts) &mdash; `zks_getProof`
	* [ZKEVM](./src/polygon/ZKEVMProver.ts) &mdash; `zkevm_getProof` &mdash; *WIP*
	* [Starknet](./src/starknet/StarknetProver.ts) &mdash; `pathfinder_getProof` &mdash; *WIP*
* Verifier Hooks
	* [Eth](./contracts/eth/EthVerifierHooks.sol) &mdash; [Patricia Merkle Tree](./contracts/eth/MerkleTrie.sol)
	* [Linea](./contracts/linea/LineaVerifierHooks.sol) &mdash; [Sparse Merkle Tree](./contracts/linea/SparseMerkleProof.sol) + [Mimc](./contracts/linea/Mimc.sol)
	* [Scroll](./contracts/scroll/ScrollVerifierHooks.sol) &mdash; Binary Merkle Tree + Poseidon
	* [ZKSync](./contracts/zksync/ZKSyncVerifierHooks.sol) &mdash; [Sparse Merkle Tree](./contracts/zksync/ZKSyncSMT.sol) + [Blake2S](./contracts/zksync/Blake2S.sol)

If you are interested in building a solution for another chain, please take a look at our our [Contribution Guidelines](#contribution-guidelines) and/or [get in touch](https://unruggable.com/contact).

## Setup

1. [`foundryup`](https://book.getfoundry.sh/getting-started/installation)
1. `forge i`
1. `bun i --frozen-lockfile`
1. create [`.env`](./.env.example)

## Running a Gateway

* `bun run serve <chain> [port]`
	* eg. `bun run serve op 9000`
	* [Chains](./src/chains.ts): `1` or `0x1` or `mainnet`
	* Default port: `8000`
	* Use `trusted:<chain>` for [`TrustedRollup`](./src/TrustedRollup.ts)
		* eg. `bun run serve trusted:op`
		* Include `0x{64}` to set signing key
	* Use `unchecked:<chain>` for [`UncheckedRollup`](./src/UncheckedRollup.ts)
	* Use `reverse:<chain>` for [`ReverseOPRollup`](./src/op/ReverseOPRollup.ts)
	* Use `self:<chain>` for [`EthSelfRollup`](./src/eth/EthSelfRollup.ts)
	* Include `--unfinalized(=minAge)` to use unfinalized commits (will throw if not available)
	* For block tag of current view of chain:
		* Default: `"finalized"`
		* Include `--latest` for `"latest"`
		* Include `--blockTag=latest|finalized|safe`
		* Include `--blockTag=-#` for relative block, eg. `getBlockNumber(latest) - #`
		* Include `--blockTag=#` for specific block
	* Include `--debug` to print `OP_DEBUG` statements
	* Include `--calls` to print RPC calls.
	* Include `--dump` to print config, latest commit, prover information, and then exit.
	* Include `--no-fast` to disable `eth_getStorageAt`
	* Include `--no-cache` to disable caching
	* Include `--no-double` to disable double rollups
		* eg. if `APE`, serves L2 &rarr; L3 instead of L1 &rarr; L2 &rarr; L3
	* Include `--depth=#` to adjust commit depth
	* Include `--step=#` to adjust commit step
	* Include `--gameTypes=1,2...` to set allowed game types for `OPFaultRollup`
	* Use [`PROVIDER_ORDER`](./test/providers.ts#L479) to customize global RPC provider priority.
	* Use `PROVIDER_ORDER_{CHAIN_NAME}` to customize per-chain RPC provider priority.
	* Use `PROVIDER_{CHAIN_NAME}` to customize per-chain RPC provider override.
	* Use `BEACON_{CHAIN_NAME}` to customize per-chain Beacon RPC provider override.

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
		* ⚠️ Polygon has poor `eth_getProof` support

## Deployments

* [Mainnet](./deployments/mainnet.json)
* [Sepolia](./deployments/sepolia.json)
* [Testing](./deployments/testing.json)

## Examples

A number of examples are provided as part of this repository. For more extensive step-wise example code, please see our [documentation](https://gateway-docs.unruggable.com/examples).

* [linea-ens](./test/v1/linea-ens.ts)
	* Replacement backend demo for https://names.linea.build/
	* `bun serve v1:linea`

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
bun script/import-op.ts
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
