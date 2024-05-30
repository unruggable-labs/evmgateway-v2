import { EVMRequest, EVMProver } from '../../src/vm.js';
import { CHAIN_MAINNET, createProvider } from '../providers.js';
import { decodeType } from '../utils.js';
import { ethers } from 'ethers';
import assert from 'node:assert/strict';

test('NFTResolver("chonk") => ChonkNFT.ownerOf(239) = "raffy"', async () => {
  const r = new EVMRequest();
  // NFTResolver: mapping["chonk"] => Chonk ERC-721
  r.setTarget('0x56942dd93A6778F4331994A1e5b2f59613DE1387')
    .setSlot(1)
    .element(ethers.id('chonk'))
    .getValue(); // #0
  // ERC721: mapping(uint256 => address) private _owners
  r.pushOutput(0).target().setSlot(2).element(239).getValue(); // #1
  const v = await EVMProver.executed(createProvider(CHAIN_MAINNET), r);
  assert.equal(
    decodeType('address', v[0].value),
    '0xE68d1aEeE2C17E43A955103DaB5E341eE439f55c'
  );
  assert.equal(
    decodeType('address', v[1].value),
    '0x51050ec063d393217B436747617aD1C2285Aeeee'
  );
});

test('Demo: firstTarget()', async () => {
  const r = new EVMRequest();
  r.push('0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'); // registry
  r.push('0x51050ec063d393217B436747617aD1C2285Aeeee'); // EOA
  r.push('0x0000000000000000000000000000000000000000'); // doesn't exist
  r.firstTarget();
  r.element(0).getValue(); // #0: registry root owner
  const v = await EVMProver.executed(createProvider(CHAIN_MAINNET), r);
  assert.equal(
    decodeType('address', v[0].value),
    '0xaB528d626EC275E3faD363fF1393A41F581c5897'
  );
});

function testENSIP10(name: string, resolver: string) {
  test(`ENSIP-10: ${name}`, async () => {
    const names = ethers
      .ensNormalize(name)
      .split('.')
      .map((_, i, v) => v.slice(-(1 + i)).join('.'));
    const r = new EVMRequest().setTarget(
      '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
    );
    for (const name of names) {
      r.setSlot(0).element(ethers.namehash(name)).addSlot(1).pushSlotRegister();
    }
    r.getFirstNonzeroValue();
    const v = await EVMProver.executed(createProvider(CHAIN_MAINNET), r);
    assert.equal(decodeType('address', v[0].value), resolver);
  });
}

testENSIP10('a.b.raffy.eth', '0x84c5AdB77dd9f362A1a3480009992d8d47325dc3');
testENSIP10('doesnot.exist', '0x0000000000000000000000000000000000000000');
