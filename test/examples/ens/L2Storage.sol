// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract L2Storage {
    struct Record {
        mapping(uint256 coinType => bytes value) addrs;
        mapping(string key => string value) texts;
        bytes contenthash;
    }

    mapping(bytes32 node => Record) records;

    function setText(
        bytes32 node,
        string memory key,
        string memory value
    ) external {
        records[node].texts[key] = value;
    }
    function setAddr(
        bytes32 node,
        uint256 coinType,
        bytes memory value
    ) external {
        records[node].addrs[coinType] = value;
    }
    function setContenthash(bytes32 node, bytes memory value) external {
        records[node].contenthash = value;
    }
}
