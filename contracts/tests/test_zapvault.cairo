use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global, stop_cheat_block_timestamp_global,
    spy_events, EventSpyAssertionsTrait,
};
use starknet::{ContractAddress, contract_address_const};
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

// ─── Test constants ───────────────────────────────────────────────────────────

fn OWNER() -> ContractAddress       { contract_address_const::<0x1>() }
fn SENDER() -> ContractAddress      { contract_address_const::<0x2>() }
fn RECIPIENT() -> ContractAddress   { contract_address_const::<0x3>() }
fn OTHER() -> ContractAddress       { contract_address_const::<0x4>() }

const ZAP_ID: felt252     = 'zap_001';
const ZAP_ID_2: felt252   = 'zap_002';
const AMOUNT: u256        = 1_000_000_000_000_000_000_u256; // 1 STRK
const EXPIRY: u64         = 2_592_000_u64;                 // 30 days in seconds
const RECIPIENT_HASH: felt252 = 'hash_of_email';

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn deploy_mock_erc20() -> ContractAddress {
    let class = declare("MockERC20").unwrap().contract_class();
    let (addr, _) = class.deploy(@array![
        'MockToken', 'MKT',
        SENDER().into(), AMOUNT.low.into(), AMOUNT.high.into()
    ]).unwrap();
    addr
}

fn deploy_vault(owner: ContractAddress) -> ContractAddress {
    let class = declare("ZapVault").unwrap().contract_class();
    let (addr, _) = class.deploy(@array![owner.into()]).unwrap();
    addr
}

fn setup() -> (ContractAddress, ContractAddress) {
    let token = deploy_mock_erc20();
    let vault = deploy_vault(OWNER());
    // Sender approves vault for AMOUNT
    start_cheat_caller_address(token, SENDER());
    IERC20Dispatcher { contract_address: token }.approve(vault, AMOUNT);
    stop_cheat_caller_address(token);
    (vault, token)
}

// ─── constructor ─────────────────────────────────────────────────────────────

#[test]
fn test_constructor_sets_owner() {
    let vault = deploy_vault(OWNER());
    let v = IZapVaultDispatcher { contract_address: vault };
    assert(v.get_owner() == OWNER(), 'owner should be set');
}

// ─── deposit ─────────────────────────────────────────────────────────────────

#[test]
fn test_deposit_success() {
    let (vault, token) = setup();
    let v = IZapVaultDispatcher { contract_address: vault };

    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    let zap = v.get_zap(ZAP_ID);
    assert(zap.sender == SENDER(), 'sender mismatch');
    assert(zap.token == token, 'token mismatch');
    assert(zap.amount == AMOUNT, 'amount mismatch');
    assert(zap.recipient_hash == RECIPIENT_HASH, 'hash mismatch');
    assert(!zap.claimed, 'should not be claimed');
}

#[test]
fn test_deposit_emits_event() {
    let (vault, token) = setup();
    let mut spy = spy_events();

    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    spy.assert_emitted(@array![(
        vault,
        ZapVault::Event::ZapDeposited(ZapVault::ZapDeposited {
            zap_id: ZAP_ID, sender: SENDER(), token, amount: AMOUNT, recipient_hash: RECIPIENT_HASH
        })
    )]);
}

#[test]
#[should_panic(expected: 'ZapVault: zap_id already used')]
fn test_deposit_duplicate_zap_id_rejected() {
    let (vault, token) = setup();
    let v = IZapVaultDispatcher { contract_address: vault };

    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID, token, AMOUNT / 2, RECIPIENT_HASH);
    // Approve again for second deposit attempt
    stop_cheat_caller_address(vault);
    start_cheat_caller_address(token, SENDER());
    IERC20Dispatcher { contract_address: token }.approve(vault, AMOUNT / 2);
    stop_cheat_caller_address(token);
    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID, token, AMOUNT / 2, RECIPIENT_HASH); // must panic
    stop_cheat_caller_address(vault);
}

#[test]
#[should_panic(expected: 'ZapVault: amount must be > 0')]
fn test_deposit_zero_amount_rejected() {
    let (vault, token) = setup();
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.deposit(ZAP_ID, token, 0_u256, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);
}

// ─── release ─────────────────────────────────────────────────────────────────

#[test]
fn test_release_success() {
    let (vault, token) = setup();
    let v = IZapVaultDispatcher { contract_address: vault };

    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    start_cheat_caller_address(vault, OWNER());
    v.release(ZAP_ID, RECIPIENT());
    stop_cheat_caller_address(vault);

    let zap = v.get_zap(ZAP_ID);
    assert(zap.claimed, 'should be claimed');
    assert(IERC20Dispatcher { contract_address: token }.balance_of(RECIPIENT()) == AMOUNT, 'recipient should have funds');
}

#[test]
fn test_release_emits_event() {
    let (vault, token) = setup();
    let mut spy = spy_events();

    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    start_cheat_caller_address(vault, OWNER());
    IZapVaultDispatcher { contract_address: vault }.release(ZAP_ID, RECIPIENT());
    stop_cheat_caller_address(vault);

    spy.assert_emitted(@array![(
        vault,
        ZapVault::Event::ZapReleased(ZapVault::ZapReleased { zap_id: ZAP_ID, recipient: RECIPIENT(), amount: AMOUNT })
    )]);
}

#[test]
#[should_panic(expected: 'ZapVault: not owner')]
fn test_release_non_owner_rejected() {
    let (vault, token) = setup();
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    start_cheat_caller_address(vault, OTHER());
    IZapVaultDispatcher { contract_address: vault }.release(ZAP_ID, RECIPIENT());
    stop_cheat_caller_address(vault);
}

#[test]
#[should_panic(expected: 'ZapVault: already claimed')]
fn test_release_double_claim_rejected() {
    let (vault, token) = setup();
    let v = IZapVaultDispatcher { contract_address: vault };

    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    start_cheat_caller_address(vault, OWNER());
    v.release(ZAP_ID, RECIPIENT());
    v.release(ZAP_ID, RECIPIENT()); // must panic
    stop_cheat_caller_address(vault);
}

#[test]
#[should_panic(expected: 'ZapVault: zap not found')]
fn test_release_not_found_rejected() {
    let vault = deploy_vault(OWNER());
    start_cheat_caller_address(vault, OWNER());
    IZapVaultDispatcher { contract_address: vault }.release('nonexistent', RECIPIENT());
    stop_cheat_caller_address(vault);
}

// ─── refund ──────────────────────────────────────────────────────────────────

#[test]
fn test_refund_after_expiry_success() {
    let (vault, token) = setup();
    let v = IZapVaultDispatcher { contract_address: vault };

    start_cheat_block_timestamp_global(1000);
    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    // Advance time past 30 days
    start_cheat_block_timestamp_global(1000 + EXPIRY + 1);
    start_cheat_caller_address(vault, SENDER());
    v.refund(ZAP_ID);
    stop_cheat_caller_address(vault);
    stop_cheat_block_timestamp_global();

    let zap = v.get_zap(ZAP_ID);
    assert(zap.claimed, 'should be marked claimed after refund');
    assert(IERC20Dispatcher { contract_address: token }.balance_of(SENDER()) == AMOUNT, 'sender should get funds back');
}

#[test]
fn test_refund_emits_event() {
    let (vault, token) = setup();
    let mut spy = spy_events();

    start_cheat_block_timestamp_global(1000);
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    start_cheat_block_timestamp_global(1000 + EXPIRY + 1);
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.refund(ZAP_ID);
    stop_cheat_caller_address(vault);
    stop_cheat_block_timestamp_global();

    spy.assert_emitted(@array![(
        vault,
        ZapVault::Event::ZapRefunded(ZapVault::ZapRefunded { zap_id: ZAP_ID, sender: SENDER(), amount: AMOUNT })
    )]);
}

#[test]
#[should_panic(expected: 'ZapVault: not yet expired')]
fn test_refund_before_expiry_rejected() {
    let (vault, token) = setup();

    start_cheat_block_timestamp_global(1000);
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    // Only 29 days later — not expired
    start_cheat_block_timestamp_global(1000 + EXPIRY - 1);
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.refund(ZAP_ID); // must panic
    stop_cheat_caller_address(vault);
    stop_cheat_block_timestamp_global();
}

#[test]
#[should_panic(expected: 'ZapVault: not sender')]
fn test_refund_non_sender_rejected() {
    let (vault, token) = setup();

    start_cheat_block_timestamp_global(1000);
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    start_cheat_block_timestamp_global(1000 + EXPIRY + 1);
    start_cheat_caller_address(vault, OTHER());
    IZapVaultDispatcher { contract_address: vault }.refund(ZAP_ID); // must panic
    stop_cheat_caller_address(vault);
    stop_cheat_block_timestamp_global();
}

#[test]
#[should_panic(expected: 'ZapVault: already claimed')]
fn test_refund_after_release_rejected() {
    let (vault, token) = setup();
    let v = IZapVaultDispatcher { contract_address: vault };

    start_cheat_block_timestamp_global(1000);
    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    start_cheat_caller_address(vault, OWNER());
    v.release(ZAP_ID, RECIPIENT()); // claim it first
    stop_cheat_caller_address(vault);

    start_cheat_block_timestamp_global(1000 + EXPIRY + 1);
    start_cheat_caller_address(vault, SENDER());
    v.refund(ZAP_ID); // must panic — already claimed
    stop_cheat_caller_address(vault);
    stop_cheat_block_timestamp_global();
}

#[test]
#[should_panic(expected: 'ZapVault: zap not found')]
fn test_refund_not_found_rejected() {
    let vault = deploy_vault(OWNER());
    start_cheat_block_timestamp_global(EXPIRY + 1);
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.refund('nonexistent');
    stop_cheat_caller_address(vault);
    stop_cheat_block_timestamp_global();
}

// ─── Expiry boundary ──────────────────────────────────────────────────────────

#[test]
fn test_refund_at_exact_expiry_boundary_succeeds() {
    let (vault, token) = setup();

    start_cheat_block_timestamp_global(0);
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    // Exactly at expiry (>=)
    start_cheat_block_timestamp_global(EXPIRY);
    start_cheat_caller_address(vault, SENDER());
    IZapVaultDispatcher { contract_address: vault }.refund(ZAP_ID);
    stop_cheat_caller_address(vault);
    stop_cheat_block_timestamp_global();
}

// ─── Full lifecycle ───────────────────────────────────────────────────────────

#[test]
fn test_full_lifecycle_deposit_release() {
    let (vault, token) = setup();
    let v = IZapVaultDispatcher { contract_address: vault };
    let erc20 = IERC20Dispatcher { contract_address: token };

    let initial_sender_balance = erc20.balance_of(SENDER());
    assert(erc20.balance_of(RECIPIENT()) == 0_u256, 'recipient starts empty');

    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    assert(erc20.balance_of(SENDER()) == initial_sender_balance - AMOUNT, 'sender debited');
    assert(erc20.balance_of(vault) == AMOUNT, 'vault holds funds');

    start_cheat_caller_address(vault, OWNER());
    v.release(ZAP_ID, RECIPIENT());
    stop_cheat_caller_address(vault);

    assert(erc20.balance_of(RECIPIENT()) == AMOUNT, 'recipient credited');
    assert(erc20.balance_of(vault) == 0_u256, 'vault empty after release');
    assert(v.get_zap(ZAP_ID).claimed, 'zap marked claimed');
}

#[test]
fn test_full_lifecycle_deposit_expire_refund() {
    let (vault, token) = setup();
    let v = IZapVaultDispatcher { contract_address: vault };
    let erc20 = IERC20Dispatcher { contract_address: token };

    let initial_balance = erc20.balance_of(SENDER());

    start_cheat_block_timestamp_global(1000);
    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID, token, AMOUNT, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    assert(erc20.balance_of(SENDER()) == initial_balance - AMOUNT, 'sender debited');

    start_cheat_block_timestamp_global(1000 + EXPIRY + 100);
    start_cheat_caller_address(vault, SENDER());
    v.refund(ZAP_ID);
    stop_cheat_caller_address(vault);
    stop_cheat_block_timestamp_global();

    assert(erc20.balance_of(SENDER()) == initial_balance, 'sender fully refunded');
    assert(erc20.balance_of(vault) == 0_u256, 'vault empty after refund');
}

#[test]
fn test_multiple_zaps_independent() {
    let (vault, token) = setup();
    let v = IZapVaultDispatcher { contract_address: vault };
    let erc20 = IERC20Dispatcher { contract_address: token };

    // Approve for two deposits
    start_cheat_caller_address(token, SENDER());
    erc20.approve(vault, AMOUNT * 2);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(vault, SENDER());
    v.deposit(ZAP_ID,   token, AMOUNT / 2, RECIPIENT_HASH);
    v.deposit(ZAP_ID_2, token, AMOUNT / 2, RECIPIENT_HASH);
    stop_cheat_caller_address(vault);

    // Release only first
    start_cheat_caller_address(vault, OWNER());
    v.release(ZAP_ID, RECIPIENT());
    stop_cheat_caller_address(vault);

    assert(v.get_zap(ZAP_ID).claimed, 'first zap claimed');
    assert(!v.get_zap(ZAP_ID_2).claimed, 'second zap still pending');
    assert(erc20.balance_of(vault) == AMOUNT / 2, 'vault still holds second zap');
}
