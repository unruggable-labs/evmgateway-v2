import { GatewayRequest } from '../../src/vm.js';
import { ProgramReader } from '../../src/reader.js';
import { getBytes, hexlify } from 'ethers/utils';

// TODO: decompiler should execute machine
// eg. OP_TARGET shows value from stack

const req = new GatewayRequest(2)
  .debug('hello')
  .setTarget('0x51050ec063d393217B436747617aD1C2285Aeeee')
  .setSlot(200)
  .pushStr('chonk')
  .follow()
  .readBytes()
  .push(0)
  .setOutput(0)
  .pushBytes('0xDEADBEEF')
  .setOutput(1);

//console.log(req.toTuple());

const encoded = getBytes(req.encode());
console.log(encoded);
console.log(hexlify(encoded));
console.log('Bytes:', encoded.length);
console.log(
  'Zeros:',
  encoded.reduce((a, x) => (a += x ? 0 : 1), 0)
);
//console.log('Ops:', new Uint8Array(req.ops));

// console.log('\n[inputs]');
// if (req.inputs.length) {
//   console.log('idx size bytes');
//   req.inputs.forEach((hex, i) =>
//     console.log(
//       i.toString().padStart(3),
//       ((hex.length - 2) >> 1).toString().padStart(4),
//       hex
//     )
//   );
// } else {
//   console.log('<none>');
// }

console.log('\n[ops]');
console.log('off  op name');
for (const action of ProgramReader.actions(req)) {
  const { pos, op, name, ...a } = action;
  console.log(
    pos.toString().padStart(3),
    op.toString().padStart(3),
    name,
    `${Object.entries(a)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')}`
  );
}
