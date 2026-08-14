export const SCOPES = ["payment", "income_statement", "book"] as const;
export type Scope = (typeof SCOPES)[number];

export type Hex = `0x${string}`;

export type PayLeaf = {
  runId: Hex;
  index: number;
  recipient: Hex;
  token: Hex;
  amount: bigint;
  memo: string;
  salt: Hex;
};

export type MerkleProof = {
  leafIndex: number;
  siblings: Hex[];
};

export type PaybookEnrollmentV1 = {
  employeeAddress: Hex;
  company: Hex;
  disclosurePublicKey: string;
  nonce: Hex;
  expiry: number;
  helper: Hex;
  chainId: string;
  signature: [Hex, Hex];
};

export type PaybookCredentialV1 = {
  issuer: Hex;
  runId: Hex;
  bookRoot: Hex;
  scope: Scope;
  subjectKeyCommitment: Hex;
  claimCommitment: Hex;
  audience: string;
  nonce: Hex;
  expiry: number;
  helper: Hex;
  chainId: string;
  issuerSignature: [Hex, Hex];
  ciphertext: string;
};

export type PaymentClaim = {
  scope: "payment";
  runId: Hex;
  index: number;
  companyName: string;
  token: Hex;
  amount: string;
  memo: string;
  leafCommit: Hex;
  merkleProof: MerkleProof;
};

export type IncomeStatementClaim = {
  scope: "income_statement";
  company: Hex;
  period: string;
  token: Hex;
  total: string;
  payments: Array<{ runId: Hex; index: number; amount: string; memo: string }>;
};

export type BookClaim = {
  scope: "book";
  runId: Hex;
  token: Hex;
  attestedTotal: string;
  leaves: Array<{
    index: number;
    recipient: Hex;
    token: Hex;
    amount: string;
    memo: string;
    salt: Hex;
    leafCommit: Hex;
  }>;
  bookRoot: Hex;
};

export type DisclosedClaims = PaymentClaim | IncomeStatementClaim | BookClaim;

export type PaybookPresentationV1 = {
  disclosedClaims: DisclosedClaims;
  credentialCommitment: Hex;
  merkleProof: MerkleProof | null;
  verifierChallenge: string;
  holderSignature: string;
  issuerSignature: [Hex, Hex];
  expiry: number;
  issuer: Hex;
  runId: Hex;
  bookRoot: Hex;
  scope: Scope;
  subjectKeyCommitment: Hex;
  audience: string;
  helper: Hex;
  chainId: string;
  /** Credential SNIP-12 nonce — needed to re-check the issuer signature. */
  credentialNonce: Hex;
  credentialExpiry: number;
};

export type EncryptedKeystore = {
  v: 1;
  kdf: "pbkdf2-sha256";
  iter: number;
  salt: string;
  nonce: string;
  ciphertext: string;
};
