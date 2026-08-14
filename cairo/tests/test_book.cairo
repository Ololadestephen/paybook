use paybook::book::{IPayrollBookDispatcher, IPayrollBookDispatcherTrait};
use paybook::types::{OP_PUBLISH_RUN, PayrollRun};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;

fn pool() -> ContractAddress {
    0x111.try_into().unwrap()
}

fn other() -> ContractAddress {
    0x222.try_into().unwrap()
}

fn token() -> ContractAddress {
    0x333.try_into().unwrap()
}

fn deploy() -> IPayrollBookDispatcher {
    let class = declare("PayrollBook").unwrap().contract_class();
    let (address, _) = class.deploy(@array![pool().into()]).unwrap();
    IPayrollBookDispatcher { contract_address: address }
}

fn publish(book: IPayrollBookDispatcher, run_id: felt252, count: u32, root: felt252, total: u128) {
    start_cheat_caller_address(book.contract_address, pool());
    let deposits = book
        .privacy_invoke(OP_PUBLISH_RUN, run_id, token(), count, root, total, 0xabc);
    stop_cheat_caller_address(book.contract_address);
    assert(deposits.len() == 0, 'expected empty span');
}

#[test]
fn constructor_stores_pool() {
    let book = deploy();
    assert(book.pool() == pool(), 'pool mismatch');
}

#[test]
fn publish_run_from_pool_returns_empty_span() {
    let book = deploy();
    publish(book, 0xaaa, 3, 0xbbb, 8);
    assert(book.has_run(0xaaa), 'missing run');
    let run: PayrollRun = book.get_run(0xaaa);
    assert(run.recipient_count == 3, 'count');
    assert(run.book_root == 0xbbb, 'root');
    assert(run.attested_total == 8, 'total');
    assert(run.token == token(), 'token');
    assert(run.ciphertext_hash == 0xabc, 'cipher');
}

#[test]
#[should_panic(expected: 'CALLER_NOT_POOL')]
fn reject_non_pool_caller() {
    let book = deploy();
    start_cheat_caller_address(book.contract_address, other());
    book.privacy_invoke(OP_PUBLISH_RUN, 1, token(), 1, 2, 0, 0);
}

#[test]
#[should_panic(expected: 'RUN_EXISTS')]
fn reject_duplicate_run_id() {
    let book = deploy();
    publish(book, 7, 1, 9, 0);
    publish(book, 7, 1, 10, 0);
}

#[test]
#[should_panic(expected: 'UNKNOWN_OPERATION')]
fn reject_unknown_operation() {
    let book = deploy();
    start_cheat_caller_address(book.contract_address, pool());
    book.privacy_invoke(99, 1, token(), 1, 2, 0, 0);
}

#[test]
#[should_panic(expected: 'ZERO_COUNT')]
fn reject_zero_recipients() {
    let book = deploy();
    start_cheat_caller_address(book.contract_address, pool());
    book.privacy_invoke(OP_PUBLISH_RUN, 1, token(), 0, 2, 0, 0);
}

#[test]
#[should_panic(expected: 'ZERO_BOOK_ROOT')]
fn reject_zero_root() {
    let book = deploy();
    start_cheat_caller_address(book.contract_address, pool());
    book.privacy_invoke(OP_PUBLISH_RUN, 1, token(), 1, 0, 0, 0);
}

#[test]
#[should_panic(expected: 'RUN_NOT_FOUND')]
fn get_missing_run_reverts() {
    let book = deploy();
    let _ = book.get_run(0xdead);
}
