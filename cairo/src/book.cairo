use starknet::ContractAddress;
use super::types::{OpenNoteDeposit, PayrollRun};

#[starknet::interface]
pub trait IPayrollBook<TContractState> {
    /// Called by the STRK20 pool via INVOKE_SELECTOR.
    /// PublishRun stores the book commitment and returns an empty span —
    /// this helper never takes, holds, or approves ERC-20.
    fn privacy_invoke(
        ref self: TContractState,
        operation: u8,
        run_id: felt252,
        token: ContractAddress,
        recipient_count: u32,
        book_root: felt252,
        attested_total: u128,
        ciphertext_hash: felt252,
    ) -> Span<OpenNoteDeposit>;

    fn get_run(self: @TContractState, run_id: felt252) -> PayrollRun;
    fn has_run(self: @TContractState, run_id: felt252) -> bool;
    fn pool(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod PayrollBook {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use super::IPayrollBook;
    use crate::types::{OP_PUBLISH_RUN, OpenNoteDeposit, PayrollRun, errors};

    #[storage]
    struct Storage {
        pool: ContractAddress,
        runs: Map<felt252, PayrollRun>,
        exists: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RunPublished: RunPublished,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RunPublished {
        #[key]
        pub run_id: felt252,
        pub token: ContractAddress,
        pub recipient_count: u32,
        pub book_root: felt252,
        pub attested_total: u128,
        pub ciphertext_hash: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, pool: ContractAddress) {
        assert(!pool.is_zero(), errors::ZERO_POOL);
        self.pool.write(pool);
    }

    #[abi(embed_v0)]
    impl PayrollBookImpl of IPayrollBook<ContractState> {
        fn privacy_invoke(
            ref self: ContractState,
            operation: u8,
            run_id: felt252,
            token: ContractAddress,
            recipient_count: u32,
            book_root: felt252,
            attested_total: u128,
            ciphertext_hash: felt252,
        ) -> Span<OpenNoteDeposit> {
            assert(get_caller_address() == self.pool.read(), errors::CALLER_NOT_POOL);
            assert(operation == OP_PUBLISH_RUN, errors::UNKNOWN_OPERATION);
            assert(run_id != 0, errors::ZERO_RUN_ID);
            assert(!token.is_zero(), errors::ZERO_TOKEN);
            assert(recipient_count != 0, errors::ZERO_COUNT);
            assert(book_root != 0, errors::ZERO_BOOK_ROOT);
            assert(!self.exists.read(run_id), errors::RUN_EXISTS);

            let created_at = get_block_timestamp();
            self
                .runs
                .write(
                    run_id,
                    PayrollRun {
                        token,
                        recipient_count,
                        book_root,
                        attested_total,
                        ciphertext_hash,
                        created_at,
                    },
                );
            self.exists.write(run_id, true);

            self
                .emit(
                    RunPublished {
                        run_id,
                        token,
                        recipient_count,
                        book_root,
                        attested_total,
                        ciphertext_hash,
                    },
                );

            // Empty span: no tokens parked, no open notes, no amount leak.
            array![].span()
        }

        fn get_run(self: @ContractState, run_id: felt252) -> PayrollRun {
            assert(self.exists.read(run_id), errors::RUN_NOT_FOUND);
            self.runs.read(run_id)
        }

        fn has_run(self: @ContractState, run_id: felt252) -> bool {
            self.exists.read(run_id)
        }

        fn pool(self: @ContractState) -> ContractAddress {
            self.pool.read()
        }
    }
}
