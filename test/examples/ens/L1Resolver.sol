// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import '../../../contracts/GatewayFetchTarget.sol';
import '../../../contracts/GatewayFetcher.sol';
import {IERC165} from '@openzeppelin/contracts/utils/introspection/IERC165.sol';

interface IExtendedResolver {
    function resolve(
        bytes memory,
        bytes memory
    ) external view returns (bytes memory);
}

contract L1Resolver is GatewayFetchTarget, IExtendedResolver, IERC165 {
    using GatewayFetcher for GatewayRequest;

    IGatewayVerifier immutable _verifier;
    address immutable _target;

    constructor(IGatewayVerifier verifier, address target) {
        _verifier = verifier;
        _target = target;
    }

    function supportsInterface(bytes4 x) external pure returns (bool) {
        return
            x == type(IERC165).interfaceId ||
            x == type(IExtendedResolver).interfaceId;
    }

    bytes4 constant SEL_addr60 = 0x3b3b57de; // addr(byte32)
    bytes4 constant SEL_addr = 0xf1cb7e06; // addr(bytes32,uint256)
    bytes4 constant SEL_text = 0x59d1d43c; // text(bytes32,string)
    bytes4 constant SEL_contenthash = 0xbc1c58d1; // contenthash(bytes32)

    function resolve(
        bytes calldata name,
        bytes calldata data
    ) external view returns (bytes memory) {
        GatewayRequest memory req = GatewayFetcher
            .newRequest(1)
            .setTarget(_target)
            .push(leadingLabelhash(name))
            .follow();
        if (bytes4(data) == SEL_addr60) {
            req.push(60).follow();
        } else if (bytes4(data) == SEL_addr) {
            (, uint256 coinType) = abi.decode(data[4:], (bytes32, uint256));
            req.push(coinType).follow();
        } else if (bytes4(data) == SEL_text) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            req.offset(1).push(key).follow();
        } else if (bytes4(data) == SEL_contenthash) {
            req.offset(2);
        } else {
            return new bytes(64);
        }
        req.readBytes().setOutput(0);
        fetch(
            _verifier,
            req,
            this.resolveCallback.selector,
            data,
            new string[](0)
        );
    }

    function resolveCallback(
        bytes[] memory values,
        uint8 /*exitCode*/,
        bytes memory data
    ) external pure returns (bytes memory) {
        bytes memory value = values[0];
        if (bytes4(data) == SEL_addr60) {
            return abi.encode(address(bytes20(value)));
        } else {
            return abi.encode(value);
        }
    }

    // this is just provided as an example w/o adding another dependency
    // use the following instead:
    // https://github.com/ensdomains/ens-contracts/blob/staging/contracts/utils/BytesUtils.sol
    function leadingLabelhash(
        bytes calldata name
    ) internal pure returns (bytes32) {
        uint256 n = uint8(name[0]);
        return keccak256(name[1:1 + n]);
    }
}
