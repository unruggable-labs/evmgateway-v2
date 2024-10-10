// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IGatewayVerifier, CommitTooOld, CommitTooNew} from './IGatewayVerifier.sol';
import {IVerifierHooks} from './IVerifierHooks.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

abstract contract AbstractVerifier is IGatewayVerifier, Ownable {
    event GatewayURLsChanged();

    string[] _urls;
    uint256 immutable _window;
    IVerifierHooks immutable _hooks;

    constructor(
        string[] memory urls,
        uint256 window,
        IVerifierHooks hooks
    ) Ownable(msg.sender) {
        _urls = urls;
        _window = window;
        _hooks = hooks;
    }

    function setGatewayURLs(string[] memory urls) external onlyOwner {
        _urls = urls;
        emit GatewayURLsChanged();
    }

    function gatewayURLs() external view returns (string[] memory) {
        return _urls;
    }

    function getWindow() external view returns (uint256) {
        return _window;
    }

    function getHooks() external view returns (IVerifierHooks) {
        return _hooks;
    }

    function _checkWindow(uint256 latest, uint256 got) internal view {
        if (got + _window < latest) revert CommitTooOld(latest, got, _window);
        if (got > latest) revert CommitTooNew(latest, got);
    }
}
