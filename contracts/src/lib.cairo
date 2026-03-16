/// ZapVault — on-chain escrow for Zap transfers
///
/// Each zap is keyed by a unique zap_id (felt252).
/// The vault holds ERC20 tokens and releases them when the
/// owner (backend) calls `release()` with the recipient address.
/// If unclaimed after EXPIRY_SECONDS, the sender can reclaim via `refund()`.

use starknet::ContractAddress;

// Inline ERC20 interface — no OpenZeppelin dependency needed
#[starknet::interface]
trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
}

#[derive(Drop, Serde, starknet::Store)]
struct ZapRecord {
    sender: ContractAddress,
    token: ContractAddress,
    amount: u256,
    recipient_hash: felt252,
    created_at: u64,
    claimed: bool,
}

#[starknet::interface]
trait IZapVault<TContractState> {
    fn deposit(
        ref self: TContractState,
        zap_id: felt252,
        token: ContractAddress,
        amount: u256,
        recipient_hash: felt252,
    );
    fn release(ref self: TContractState, zap_id: felt252, recipient: ContractAddress);
    fn refund(ref self: TContractState, zap_id: felt252);
    fn get_zap(self: @TContractState, zap_id: felt252) -> ZapRecord;
    fn get_owner(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
mod ZapVault {
    use super::{ZapRecord, IZapVault, IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess,
    };

    const EXPIRY_SECONDS: u64 = 2592000_u64; // 30 days

    #[storage]
    struct Storage {
        owner: ContractAddress,
        zaps: starknet::storage::Map<felt252, ZapRecord>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ZapDeposited: ZapDeposited,
        ZapReleased: ZapReleased,
        ZapRefunded: ZapRefunded,
    }

    #[derive(Drop, starknet::Event)]
    struct ZapDeposited {
        #[key] zap_id: felt252,
        sender: ContractAddress,
        token: ContractAddress,
        amount: u256,
        recipient_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct ZapReleased {
        #[key] zap_id: felt252,
        recipient: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct ZapRefunded {
        #[key] zap_id: felt252,
        sender: ContractAddress,
        amount: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl ZapVaultImpl of IZapVault<ContractState> {

        fn deposit(
            ref self: ContractState,
            zap_id: felt252,
            token: ContractAddress,
            amount: u256,
            recipient_hash: felt252,
        ) {
            let sender = get_caller_address();
            let existing = self.zaps.read(zap_id);
            assert(existing.amount == 0_u256, 'ZapVault: zap_id already used');
            assert(amount > 0_u256, 'ZapVault: amount must be > 0');

            let erc20 = IERC20Dispatcher { contract_address: token };
            erc20.transfer_from(sender, get_contract_address(), amount);

            self.zaps.write(zap_id, ZapRecord {
                sender, token, amount, recipient_hash,
                created_at: get_block_timestamp(),
                claimed: false,
            });

            self.emit(ZapDeposited { zap_id, sender, token, amount, recipient_hash });
        }

        fn release(ref self: ContractState, zap_id: felt252, recipient: ContractAddress) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'ZapVault: not owner');

            let zap = self.zaps.read(zap_id);
            assert(zap.amount > 0_u256, 'ZapVault: zap not found');
            assert(!zap.claimed, 'ZapVault: already claimed');

            self.zaps.write(zap_id, ZapRecord { claimed: true, ..zap });

            let erc20 = IERC20Dispatcher { contract_address: zap.token };
            erc20.transfer(recipient, zap.amount);

            self.emit(ZapReleased { zap_id, recipient, amount: zap.amount });
        }

        fn refund(ref self: ContractState, zap_id: felt252) {
            let zap = self.zaps.read(zap_id);
            assert(zap.amount > 0_u256, 'ZapVault: zap not found');
            assert(!zap.claimed, 'ZapVault: already claimed');
            assert(get_caller_address() == zap.sender, 'ZapVault: not sender');
            assert(
                get_block_timestamp() >= zap.created_at + EXPIRY_SECONDS,
                'ZapVault: not yet expired',
            );

            self.zaps.write(zap_id, ZapRecord { claimed: true, ..zap });

            let erc20 = IERC20Dispatcher { contract_address: zap.token };
            erc20.transfer(zap.sender, zap.amount);

            self.emit(ZapRefunded { zap_id, sender: zap.sender, amount: zap.amount });
        }

        fn get_zap(self: @ContractState, zap_id: felt252) -> ZapRecord {
            self.zaps.read(zap_id)
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
    }
}
