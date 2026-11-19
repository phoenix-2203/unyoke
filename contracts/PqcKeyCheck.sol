// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title PqcKeyCheck
/// @notice Reads an account's post-quantum key from QoreChain's PQC Key Status
///         precompile (0x…0a02) for Unyoke's scan. Read-only: it holds nothing,
///         owns nothing and has no admin.
/// @dev The precompile answers a call with empty data when it is not active on a
///      network (QoreChain mainnet today). Empty data would decode as "no key",
///      so this contract reverts instead of guessing.
contract PqcKeyCheck {
    address internal constant PQC_KEY_STATUS = 0x0000000000000000000000000000000000000a02;

    /// The precompile is not active here, or answered with too little data.
    error PrecompileInactive();

    /// @return registered        an ML-DSA key is registered for the account
    /// @return algorithmId       1 = ML-DSA-87
    /// @return possessionProven  the key was registered with a verified proof of possession
    function status(address account)
        public
        view
        returns (bool registered, uint8 algorithmId, bool possessionProven)
    {
        (bool ok, bytes memory ret) =
            PQC_KEY_STATUS.staticcall(abi.encodeWithSignature("pqcKeyStatus(address)", account));
        // four head words plus the length word of the (possibly empty) public key
        if (!ok || ret.length < 160) revert PrecompileInactive();
        (registered, algorithmId,, possessionProven) = abi.decode(ret, (bool, uint8, bytes, bool));
    }

    /// @notice True only if the account has a registered key it proved it holds.
    ///         `registered` alone is not enough: proof of possession is optional.
    function isProven(address account) external view returns (bool) {
        (bool registered,, bool possessionProven) = status(account);
        return registered && possessionProven;
    }
}
