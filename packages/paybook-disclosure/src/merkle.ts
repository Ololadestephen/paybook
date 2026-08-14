import { poseidon } from "./poseidon.js";
import { toHex, toBig } from "./hex.js";
import type { Hex, MerkleProof } from "./types.js";

export function merkleRoot(leaves: Array<string | bigint>): Hex {
  if (leaves.length === 0) throw new Error("empty tree");
  let level = padLevel(leaves.map((l) => toBig(l)));
  while (level.length > 1) {
    const next: bigint[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(toBig(poseidon([level[i], level[i + 1]])));
    }
    level = next;
  }
  return toHex(level[0]);
}

export function merkleProof(leaves: Array<string | bigint>, index: number): MerkleProof {
  if (index < 0 || index >= leaves.length) throw new Error("leaf index out of range");
  let level = padLevel(leaves.map((l) => toBig(l)));
  let i = index;
  const siblings: Hex[] = [];
  while (level.length > 1) {
    const pair = i ^ 1;
    siblings.push(toHex(level[pair]));
    const next: bigint[] = [];
    for (let j = 0; j < level.length; j += 2) {
      next.push(toBig(poseidon([level[j], level[j + 1]])));
    }
    level = next;
    i = Math.floor(i / 2);
  }
  return { leafIndex: index, siblings };
}

export function verifyMerkleProof(leaf: string | bigint, proof: MerkleProof, root: string): boolean {
  let acc = toBig(leaf);
  let i = proof.leafIndex;
  for (const sib of proof.siblings) {
    const s = toBig(sib);
    acc = i % 2 === 0 ? toBig(poseidon([acc, s])) : toBig(poseidon([s, acc]));
    i = Math.floor(i / 2);
  }
  return toHex(acc) === toHex(toBig(root));
}

function padLevel(leaves: bigint[]): bigint[] {
  let n = 1;
  while (n < leaves.length) n *= 2;
  const padded = leaves.slice();
  while (padded.length < n) padded.push(0n);
  return padded;
}
