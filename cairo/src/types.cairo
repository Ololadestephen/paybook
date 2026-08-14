use starknet::ContractAddress;

/// Must match `privacy::objects::OpenNoteDeposit` positional Serde.
#[derive(Serde, Copy, Drop, PartialEq)]
pub struct OpenNoteDeposit {
    pub note_id: felt252,
    pub token: ContractAddress,
    pub amount: u128,
}

#[derive(Serde, Copy, Drop, starknet::Store, PartialEq)]
pub struct PayrollRun {
    pub token: ContractAddress,
    pub recipient_count: u32,
    pub book_root: felt252,
    pub attested_total: u128,
    pub ciphertext_hash: felt252,
    pub created_at: u64,
}

pub const OP_PUBLISH_RUN: u8 = 1;

pub mod errors {
    pub const CALLER_NOT_POOL: felt252 = 'CALLER_NOT_POOL';
    pub const UNKNOWN_OPERATION: felt252 = 'UNKNOWN_OPERATION';
    pub const ZERO_RUN_ID: felt252 = 'ZERO_RUN_ID';
    pub const ZERO_TOKEN: felt252 = 'ZERO_TOKEN';
    pub const ZERO_COUNT: felt252 = 'ZERO_COUNT';
    pub const ZERO_BOOK_ROOT: felt252 = 'ZERO_BOOK_ROOT';
    pub const RUN_EXISTS: felt252 = 'RUN_EXISTS';
    pub const RUN_NOT_FOUND: felt252 = 'RUN_NOT_FOUND';
    pub const ZERO_POOL: felt252 = 'ZERO_POOL';
}
